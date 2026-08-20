import { NextResponse } from 'next/server';

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

type Task = {
  instruction: string;
  status: TaskStatus;
  statusText: string;
};

type AgentRequest = {
  accessCode?: unknown;
  action?: unknown;
  instruction?: unknown;
  agentStatus?: { status?: unknown; text?: unknown };
};

let currentTask: Task | null = null;

function authorized(accessCode: unknown): boolean {
  return Boolean(process.env.APP_ACCESS_CODE) && accessCode === process.env.APP_ACCESS_CODE;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentRequest;
    if (!authorized(body.accessCode)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (body.action === 'SET_TASK' && typeof body.instruction === 'string' && body.instruction.trim()) {
      currentTask = {
        instruction: body.instruction.trim(),
        status: 'pending',
        statusText: 'Waiting for host...',
      };
      return NextResponse.json({ success: true });
    }

    if (body.action === 'GET_STATUS') {
      return NextResponse.json({ task: currentTask });
    }

    if (body.action === 'UPDATE_FROM_AGENT' && currentTask && body.agentStatus) {
      const { status, text } = body.agentStatus;
      if (typeof status === 'string' && typeof text === 'string') {
        currentTask.status = status as TaskStatus;
        currentTask.statusText = text;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (!authorized(secret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ task: currentTask });
}