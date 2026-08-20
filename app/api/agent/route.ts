import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
type Task = { instruction: string; status: TaskStatus; statusText: string };
type AgentRequest = {
  accessCode?: unknown;
  action?: unknown;
  instruction?: unknown;
  agentStatus?: { status?: unknown; text?: unknown };
  newPrompt?: unknown;
};

let currentTask: Task | null = null;
const DEFAULT_PROMPT = `You are the Lead Infrastructure Dispatcher and LLM Router of a distributed compute network.
Classify each incoming directive by technical complexity and assign the optimal worker node.
Primary handles architecture, complex logic, structural analysis, and final PoC assembly.
Mistral handles intermediate scripting, refactoring, extraction, vectorization, and metadata aggregation.
Groq handles only raw HTML processing, link harvesting, high-volume log parsing, and simple form filling.
Fast nodes must not perform logical planning. Return strict JSON with target_node (groq, mistral, or primary), reasoning, and masked_instruction.`;

async function ensureTableExists(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS routing_config (
      id SERIAL PRIMARY KEY,
      prompt_text TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  const result = await sql`SELECT id FROM routing_config ORDER BY id LIMIT 1`;
  if (result.rows.length === 0) {
    await sql`INSERT INTO routing_config (prompt_text) VALUES (${DEFAULT_PROMPT})`;
  }
}

async function getRoutingPrompt(): Promise<string> {
  await ensureTableExists();
  const result = await sql`SELECT prompt_text FROM routing_config ORDER BY id LIMIT 1`;
  const prompt = result.rows[0]?.prompt_text;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Routing prompt is missing from routing_config');
  }
  return prompt;
}

function authorized(accessCode: unknown): boolean {
  const configuredCode = process.env.APP_ACCESS_CODE ?? process.env.NEXT_PUBLIC_APP_ACCESS_CODE;
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
      currentTask = {
        instruction: body.instruction.trim(),
        status: 'pending',
        statusText: 'Supervisor node dispatching work...',
      };
      return NextResponse.json({ success: true });
    }

    if (body.action === 'GET_STATUS') {
      return NextResponse.json({ task: currentTask });
    }

    if (body.action === 'UPDATE_FROM_AGENT' && currentTask && body.agentStatus) {
      const { status, text } = body.agentStatus;
      const validStatuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed'];
      if (typeof status === 'string' && validStatuses.includes(status as TaskStatus) && typeof text === 'string') {
        currentTask.status = status as TaskStatus;
        currentTask.statusText = text;
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === 'GET_PROMPT') {
      return NextResponse.json({ routingPrompt: await getRoutingPrompt() });
    }

    if (body.action === 'UPDATE_PROMPT' && typeof body.newPrompt === 'string' && body.newPrompt.trim()) {
      const newPrompt = body.newPrompt.trim();
      if (newPrompt.length > 20_000) {
        return NextResponse.json({ error: 'Prompt is too long' }, { status: 400 });
      }
      await sql`
        UPDATE routing_config
        SET prompt_text = ${newPrompt}, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM routing_config ORDER BY id LIMIT 1)
      `;
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
    return NextResponse.json({ task: currentTask });
  } catch (error) {
    console.error('Agent database error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}