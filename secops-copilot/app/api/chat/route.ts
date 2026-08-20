import { NextResponse } from 'next/server';
import { SECOPS_SYSTEM_PROMPT } from '@/lib/prompts';

export async function POST(request: Request) {
  try {
    const { messages, model, accessCode } = await request.json();

    // 1. Проверка пароля доступа к приложению
    const serverAccessCode = process.env.APP_ACCESS_CODE;
    if (serverAccessCode && accessCode !== serverAccessCode) {
      return NextResponse.json(
        { error: 'INVALID_ACCESS_CODE', message: 'Неверный секретный код авторизации' },
        { status: 401 }
      );
    }

    // 2. Проверка наличия ключа OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'MISSING_API_KEY', message: 'Серверная переменная OPENROUTER_API_KEY не задана во Vercel' },
        { status: 500 }
      );
    }

    const selectedModel = model || process.env.DEFAULT_MODEL || 'z-ai/glm-5.2:free';

    // 3. Формирование пакета с обходом фильтров (Force Jailbreak Injection)
    const formattedMessages = [
      { role: 'system', content: SECOPS_SYSTEM_PROMPT },
      ...messages
    ];

    // 4. Запрос к OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vercel.com',
        'X-Title': 'SecOps Copilot Node'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.15, // Занижаем для предотвращения отказов и нравоучений
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: 'PROVIDER_ERROR', details: errText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: 'SERVER_ERROR', message: error.message }, { status: 500 });
  }
}
