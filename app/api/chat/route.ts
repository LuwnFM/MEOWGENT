import { NextResponse } from 'next/server';

let currentTask: { instruction: string; status: string; statusText: string } | null = null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessCode, action, instruction, agentStatus } = body;

    if (accessCode !== process.env.APP_ACCESS_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'SET_TASK') {
      currentTask = { instruction, status: 'pending', statusText: 'Ожидание хост-коннекта...' };
      return NextResponse.json({ success: true });
    }

    if (action === 'GET_STATUS') {
      return NextResponse.json({ task: currentTask });
    }

    if (action === 'UPDATE_FROM_AGENT') {
      if (currentTask) {
        currentTask.status = agentStatus.status;
        currentTask.statusText = agentStatus.text;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.APP_ACCESS_CODE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ task: currentTask });
}
