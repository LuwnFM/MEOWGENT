import { NextResponse } from 'next/server';
import { verifyAccessCode, accessCodeFromRequest } from '@/lib/security';

export const runtime = 'nodejs';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type OpenRouterResponse = { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

export async function POST(req: Request) {
  try {
    const body = await req.json() as { accessCode?: unknown; messages?: unknown };
    if (!verifyAccessCode(accessCodeFromRequest(req) ?? body.accessCode)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }
    const messages = body.messages.filter((item: unknown): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const message = item as Partial<ChatMessage>;
      return (message.role === 'user' || message.role === 'assistant')
        && typeof message.content === 'string'
        && message.content.trim().length > 0 && message.content.length <= 8000;
    }).slice(-20);
    if (!messages.length || !messages.some(message => message.role === 'user')) {
      return NextResponse.json({ error: 'At least one user message is required' }, { status: 400 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Chat provider is not configured' }, { status: 503 });
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'X-Title': 'SecOps MEOWGENT',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct',
        messages: [{ role: 'system', content: 'You are a concise cybersecurity assistant. Only perform authorized defensive and testing tasks.' }, ...messages],
      }),
    });
    const data = await response.json() as OpenRouterResponse;
    if (!response.ok) return NextResponse.json({ error: 'Chat provider request failed' }, { status: 502 });
    return NextResponse.json({ content: data.choices?.[0]?.message?.content || '' });
  } catch {
    return NextResponse.json({ error: 'Unable to process chat request' }, { status: 500 });
  }
}
