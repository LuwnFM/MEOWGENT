import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const validMessages = messages
      .filter((message: unknown): message is ChatMessage => {
        if (!message || typeof message !== 'object') return false;
        const candidate = message as Partial<ChatMessage>;
        return ['user', 'assistant', 'system'].includes(candidate.role ?? '')
          && typeof candidate.content === 'string'
          && candidate.content.trim().length > 0;
      })
      .slice(-20);

    if (validMessages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required.' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chat provider is not configured.' }, { status: 503 });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': req.headers.get('origin') ?? 'https://vercel.app',
        'X-Title': 'Meowgent Core',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct',
        messages: validMessages,
      }),
    });
    const data = await response.json() as OpenRouterResponse;
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Chat provider request failed.' }, { status: 502 });
    }

    return NextResponse.json({ content: data.choices?.[0]?.message?.content || '' });
  } catch {
    return NextResponse.json({ error: 'Unable to process chat request.' }, { status: 500 });
  }
}
