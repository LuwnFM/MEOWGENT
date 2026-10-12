import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createPool } from '@vercel/postgres';
import { enqueueAgentJob } from '@/lib/queue';
import { inngest } from '@/lib/inngest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
type Task = { id?: number; instruction: string; status: TaskStatus; statusText: string };
type AgentRequest = {
  accessCode?: unknown;
  action?: unknown;
  instruction?: unknown;
  agentStatus?: { status?: unknown; text?: unknown };
  newPrompt?: unknown;
  taskId?: unknown;
  fileKeys?: unknown;
};

const DEFAULT_PROMPT = `You are the Lead Infrastructure Dispatcher and LLM Router of a distributed compute network.
Classify each incoming directive by technical complexity and assign the optimal worker node.
Primary handles architecture, complex logic, structural analysis, and final PoC assembly.
Mistral handles intermediate scripting, refactoring, extraction, vectorization, and metadata aggregation.
Groq handles only raw HTML processing, link harvesting, high-volume log parsing, and simple form filling.
Fast nodes must not perform logical planning. Return strict JSON with target_node (groq, mistral, or primary), reasoning, and masked_instruction.`;

function database() {
  const databaseUrl = process.env.DATABASE_URL;
  return databaseUrl ? neon(databaseUrl) : null;
}

type DatabaseRow = Record<string, unknown>;
type DatabaseValue = string | number | boolean | null | undefined;

let vercelPool: ReturnType<typeof createPool> | null = null;

async function queryDatabase(query: string, values: DatabaseValue[] = []): Promise<DatabaseRow[]> {
  // A configured database is authoritative. Never silently switch to a second
  // database after a query failure: that can split tasks and routing settings.
  const neonDatabase = database();
  if (neonDatabase) return await neonDatabase.query(query, values) as DatabaseRow[];
  const vercelUrl = process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (vercelUrl) {
    vercelPool ??= createPool({ connectionString: vercelUrl });
    const result = await vercelPool.query<DatabaseRow>(query, values);
    return result.rows as DatabaseRow[];
  }
  throw new Error('No database configured. Set DATABASE_URL or POSTGRES_URL.');
}

async function ensureTableExists(): Promise<void> {
  await queryDatabase(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id SERIAL PRIMARY KEY,
      instruction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      status_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryDatabase(`
    CREATE TABLE IF NOT EXISTS routing_config (
      id SERIAL PRIMARY KEY,
      prompt_text TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const result = await queryDatabase('SELECT id FROM routing_config ORDER BY id LIMIT 1');
  if (result.length === 0) {
    await queryDatabase('INSERT INTO routing_config (prompt_text) VALUES ($1)', [DEFAULT_PROMPT]);
  }
}

async function getRoutingPrompt(): Promise<string> {
  await ensureTableExists();
  const result = await queryDatabase('SELECT prompt_text FROM routing_config ORDER BY id LIMIT 1');
  const prompt = result[0]?.prompt_text;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Routing prompt is missing from routing_config');
  }
  return prompt;
}

function authorized(accessCode: unknown): boolean {
  const configuredCode = process.env.APP_ACCESS_CODE;
  return Boolean(configuredCode) && accessCode === configuredCode;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentRequest;
    if (!authorized(body.accessCode)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureTableExists();

    if (body.action === 'SET_TASK' && typeof body.instruction === 'string' && body.instruction.trim()) {
      const instruction = body.instruction.trim();
      const rows = await queryDatabase(
        'INSERT INTO agent_tasks (instruction, status, status_text) VALUES ($1, $2, $3) RETURNING id',
        [instruction, 'pending', 'Supervisor node dispatching work...'],
      );
      const taskId = Number(rows[0]?.id);
      if (!Number.isSafeInteger(taskId) || taskId <= 0) throw new Error('Task ID was not returned');
      const fileKeys = Array.isArray(body.fileKeys) ? body.fileKeys.filter((key): key is string => typeof key === 'string').slice(0, 20) : [];
      if (process.env.REDIS_URL) await enqueueAgentJob({ taskId, instruction, fileKeys });
      if (process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'agent/job.created', data: { taskId, instruction, fileKeys } });
      return NextResponse.json({ success: true, taskId });
    }

    if (body.action === 'GET_STATUS') {
      const requestedId = Number(body.taskId);
      const hasId = body.taskId !== undefined && body.taskId !== null;
      if (hasId && (!Number.isSafeInteger(requestedId) || requestedId <= 0)) return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
      const rows = hasId
        ? await queryDatabase('SELECT id, instruction, status, status_text FROM agent_tasks WHERE id = $1', [requestedId])
        : await queryDatabase('SELECT id, instruction, status, status_text FROM agent_tasks ORDER BY id DESC LIMIT 1');
      const row = rows[0];
      return NextResponse.json({ task: row ? { id: Number(row.id), instruction: String(row.instruction), status: row.status, statusText: String(row.status_text) } : null });
    }

    if (body.action === 'UPDATE_FROM_AGENT' && body.agentStatus) {
      const { status, text } = body.agentStatus;
      const validStatuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed'];
      const taskId = Number(body.taskId);
      if (!Number.isSafeInteger(taskId) || taskId <= 0) return NextResponse.json({ error: 'taskId is required for updates' }, { status: 400 });
      if (typeof status !== 'string' || !validStatuses.includes(status as TaskStatus) || typeof text !== 'string' || text.length > 20000) {
        return NextResponse.json({ error: 'Invalid agent status' }, { status: 400 });
      }
      const updated = await queryDatabase(
        'UPDATE agent_tasks SET status = $1, status_text = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id',
        [status, text, taskId],
      );
      if (!updated.length) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      return NextResponse.json({ success: true, taskId });
    }

    if (body.action === 'GET_PROMPT') {
      return NextResponse.json({ routingPrompt: await getRoutingPrompt() });
    }

    if (body.action === 'UPDATE_PROMPT' && typeof body.newPrompt === 'string' && body.newPrompt.trim()) {
      const newPrompt = body.newPrompt.trim();
      if (newPrompt.length > 20_000) {
        return NextResponse.json({ error: 'Prompt is too long' }, { status: 400 });
      }
      await queryDatabase(`
        UPDATE routing_config
        SET prompt_text = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM routing_config ORDER BY id LIMIT 1)
      `, [newPrompt]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch (error) {
    console.error('Agent route error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (!authorized(secret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await ensureTableExists();
    const requestedId = new URL(request.url).searchParams.get('taskId');
    const id = requestedId === null ? null : Number(requestedId);
    if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    const rows = id === null
      ? await queryDatabase('SELECT id, instruction, status, status_text FROM agent_tasks ORDER BY id DESC LIMIT 1')
      : await queryDatabase('SELECT id, instruction, status, status_text FROM agent_tasks WHERE id = $1', [id]);
    const row = rows[0];
    return NextResponse.json({ task: row ? { id: Number(row.id), instruction: String(row.instruction), status: row.status, statusText: String(row.status_text) } : null });
  } catch (error) {
    console.error('Agent database error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}