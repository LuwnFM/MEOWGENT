Please upgrade our repository architecture to support a high-performance, cost-efficient multi-provider routing system (Supervisor-Workers pattern). We need to integrate supplementary free API routes (Groq API for high-speed layout parsing, Mistral API for operational logic/embeddings, and g4f fallback) managed dynamically by our primary dispatcher LLM.

Ensure all core files are located strictly at the repository root level with standardized App Router naming conventions.

Please inject, overwrite, and structure the following 4 files directly into the workspace:

File 1 [API Endpoint Gateway] -> Path: `app/api/agent/route.ts`
```typescript
import { NextResponse } from 'next/server';

let currentTask: { instruction: string; status: string; statusText: string } | null = null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessCode, action, instruction, agentStatus } = body;

    if (accessCode !== process.env.APP_ACCESS_CODE && accessCode !== process.env.NEXT_PUBLIC_APP_ACCESS_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'SET_TASK') {
      currentTask = { instruction, status: 'pending', statusText: 'Supervisor node dispatching work...' };
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
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.APP_ACCESS_CODE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ task: currentTask });
}
```

File 2 [Dashboard Interface] -> Path: `components/AgentPanel.tsx`
```tsx
'use client';

import React, { useState, useEffect } from 'react';

type TaskStatus = 'offline' | 'pending' | 'running' | 'completed' | 'failed';

export default function AgentPanel({ accessCode }: { accessCode: string }) {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<TaskStatus>('offline');
  const [text, setText] = useState('System ready. Multi-provider cascade active.');
  const [load, setLoad] = useState(false);

  const sync = async () => {
    if (!accessCode) return;
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, action: 'GET_STATUS' })
      });
      const data = await res.json();
      if (data.task) {
        setStatus(data.task.status);
        setText(data.task.statusText);
      }
    } catch (e) {}
  };

  useEffect(() => {
    const int = setInterval(sync, 4000);
    return () => clearInterval(int);
  }, [accessCode]);

  const run = async () => {
    if (!instruction.trim() || !accessCode) return;
    setLoad(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, action: 'SET_TASK', instruction: instruction.trim() })
      });
      if (res.ok) setStatus('pending');
    } catch (e) {} finally { setLoad(false); }
  };

  return (
    <div style={{ background: '#050505', color: '#00ff00', padding: '20px', fontFamily: 'monospace', border: '1px solid #333', borderRadius: '4px' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#00ffff' }}>⚡️ MULTI-PROVIDER AGENT TERMINAL</h3>
      <p style={{ fontSize: '11px', color: '#666', margin: '0 0 15px 0' }}>Cascades: OpenRouter (Primary) -> Groq API (Pacing) -> Mistral API (Embeds) -> g4f (Fallback)</p>
      
      <textarea
        rows={4}
        style={{ width: '100%', background: '#111', color: '#00ff00', border: '1px solid #00ff00', padding: '10px', borderRadius: '4px' }}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Enter global workflow directive..."
      />
      
      <button
        onClick={run}
        disabled={load || !accessCode}
        style={{ marginTop: '12px', width: '100%', background: '#00ff00', color: '#000', border: 'none', padding: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}
      >
        {load ? 'ROUTING TASK...' : 'DISPATCH TO DISTRIBUTED NETWORK'}
      </button>

      <div style={{ marginTop: '20px', borderTop: '1px solid #222', paddingTop: '15px' }}>
        <p style={{ margin: '4px 0' }}><strong>NODE STATUS:</strong> <span style={{ color: status === 'completed' ? '#00ffff' : '#ffff00' }}>{status.toUpperCase()}</span></p>
        <p style={{ margin: '4px 0', color: '#aaa', fontSize: '12px' }}><strong>EXECUTION LOG:</strong> {text}</p>
      </div>
    </div>
  );
}
```

File 3 [Core Router Shell] -> Path: `app/page.tsx`
```tsx
'use client';

import React, { useState } from 'react';
import AgentPanel from '@/components/AgentPanel';

export default function MainPage() {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('chat');

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#00ff00', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '25px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="password"
          placeholder="ENTER APP ACCESS CODE"
          style={{ background: '#111', color: '#00ff00', border: '1px solid #333', padding: '10px', borderRadius: '4px' }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button onClick={() => setTab('chat')} style={{ padding: '10px 20px', background: 'none', border: '1px solid #333', color: tab === 'chat' ? '#00ff00' : '#444', cursor: 'pointer' }}>CONVENTIONAL CHAT</button>
        <button onClick={() => setTab('agent')} style={{ padding: '10px 20px', background: 'none', border: '1px solid #333', color: tab === 'agent' ? '#00ff00' : '#444', cursor: 'pointer' }}>DISTRIBUTED AGENT</button>
      </div>
      
      {tab === 'chat' ? (
        <div style={{ border: '1px solid #222', padding: '20px', color: '#666' }}>Standard SecOps static review panel active. Please switch tabs to access the automated cluster.</div>
      ) : (
        <AgentPanel accessCode={code} />
      )}
    </div>
  );
}
```

File 4 [Distributed Worker Daemon] -> Path: `secops_core_agent.py`
```python
import time
import random
import requests
from browser_use import Agent
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

# Advanced compliance framing for intermediate tasks (Bypasses provider friction safely)
SP_DISPATCHER = "You are a lead system infrastructure dispatcher. Decompose the request into dry, compliance-friendly automation scripts."
SP_WORKER = "You are an industrial web automation script execution routine. Process the assigned task objectively, use human-like delays, and format output cleanly."

URL = "https://vercel.app" # UPDATE WITH YOUR VERCEL DOMAIN
CODE = "YOUR_APP_ACCESS_CODE"

# Стек подключенных подрядчиков через переменные окружения ОС компьютера
OPENROUTER_KEY = SecretStr(os.getenv("OPENROUTER_API_KEY", "sk-or-v1-..."))
GROQ_KEY = SecretStr(os.getenv("GROQ_API_KEY", "gsk_..."))
MISTRAL_KEY = SecretStr(os.getenv("MISTRAL_API_KEY", "mock_key"))

# Модели
llm_dispatcher = ChatOpenAI(base_url="https://openrouter.ai", api_key=OPENROUTER_KEY, model="qwen/qwen-2.5-72b-instruct")
llm_groq = ChatOpenAI(base_url="https://groq.com", api_key=GROQ_KEY, model="llama3-8b-8192")
llm_mistral = ChatOpenAI(base_url="https://mistral.ai", api_key=MISTRAL_KEY, model="open-mistral-7b")

def log_to_server(text, status="running"):
    try: requests.post(URL, json={"accessCode": CODE, "action": "UPDATE_FROM_AGENT", "agentStatus": {"status": status, "text": text}})
    except: pass

print("[*] Distributed Load Balancing Worker running. Listening for cluster tasks...")
while True:
    try:
        res = requests.get(f"{URL}?secret={CODE}").json()
        t = res.get("task")
        if t and t.get("status") == "pending":
            ins = t.get("instruction")
            log_to_server("Диспетчер декомпозирует задачу и маскирует триггер-слова...", "running")
            
            # Автоматическая логика жонглирования запросами (Load Balancing)
            is_layout_or_parsing = any(w in ins.lower() for w in ["парс", "собери", "html", "scrape", "find"])
            
            if is_layout_or_parsing:
                log_to_server("Высокая интенсивность данных. Задача перенаправлена на бесплатный поток Groq API (Llama-3)...")
                selected_llm = llm_groq
            else:
                log_to_server("Сложная координация. Вызов базовой модели OpenRouter...")
                selected_llm = llm_dispatcher
                
            # Исполнение в скрытом браузере
            agent = Agent(task=f"{SP_WORKER}\n\nTARGET ACTION: {ins}", llm=selected_llm)
            agent.run()
            
            log_to_server("Операция завершена всеми распределенными узлами сети.", "completed")
    except Exception as e:
        print(f"[-] Daemon loop check skipped: {e}")
    time.sleep(20)
```

