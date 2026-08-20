'use client';

import { useEffect, useState } from 'react';

type TaskStatus = 'offline' | 'pending' | 'running' | 'completed' | 'failed';

type Task = { instruction: string; status: TaskStatus; statusText: string };

type AgentResponse = {
  task?: Task | null;
};

export default function AgentPanel({ accessCode }: { accessCode: string }) {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<TaskStatus>('offline');
  const [text, setText] = useState('System ready. Multi-provider cascade active.');
  const [load, setLoad] = useState(false);

  const sync = async () => {
    if (!accessCode) {
      setStatus('offline');
      setText('Enter an access code to connect.');
      return;
    }

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, action: 'GET_STATUS' }),
      });
      const data = (await response.json()) as AgentResponse;
      if (response.ok && data.task) {
        setStatus(data.task.status);
        setText(data.task.statusText);
      }
    } catch {
      setStatus('offline');
      setText('Agent unavailable.');
    }
  };

  useEffect(() => {
    void sync();
    const interval = window.setInterval(() => void sync(), 4000);
    return () => window.clearInterval(interval);
  }, [accessCode]);

  const run = async () => {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction || !accessCode) return;

    setLoad(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, action: 'SET_TASK', instruction: trimmedInstruction }),
      });
      if (!response.ok) throw new Error('Task could not be submitted');
      setStatus('pending');
      setText('Supervisor node dispatching work...');
      setInstruction('');
    } catch {
      setStatus('failed');
      setText('Task submission failed.');
    } finally {
      setLoad(false);
    }
  };

  return (
    <section className="border border-zinc-800 bg-zinc-950 rounded-xl p-4 font-mono">
      <h2 className="text-sm font-bold tracking-wider text-emerald-400">MULTI-PROVIDER AGENT TERMINAL</h2>
      <p className="mt-1 text-[11px] text-zinc-500">OpenRouter (Primary) -&gt; Groq (Pacing) -&gt; Mistral (Embeds) -&gt; g4f (Fallback)</p>
      <textarea
        rows={4}
        className="mt-4 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-emerald-300 outline-none focus:border-emerald-700"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Enter task instructions..."
      />
      <button
        type="button"
        onClick={() => void run()}
        disabled={load || !accessCode || !instruction.trim()}
        className="mt-3 w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {load ? 'ROUTING TASK...' : 'DISPATCH TO DISTRIBUTED NETWORK'}
      </button>
      <div className="mt-4 border-t border-zinc-800 pt-3 text-sm">
        <p className="text-emerald-400">NODE STATUS: {status.toUpperCase()}</p>
        <p className="mt-1 text-zinc-500">LOG: {text}</p>
      </div>
    </section>
  );
}
