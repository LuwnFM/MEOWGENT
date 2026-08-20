'use client';

import { useState } from 'react';
import AgentPanel from '@/components/AgentPanel';

export default function MainPage() {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'chat' | 'agent'>('chat');
  
  return (
    <div className="min-h-screen bg-black p-5 font-mono text-emerald-400">
      <div className="mb-6 flex items-center gap-3">
        <input type="password" placeholder="ENTER APP ACCESS CODE" value={code} onChange={(event) => setCode(event.target.value)} className="rounded border border-zinc-700 bg-zinc-900 p-2.5 text-emerald-400" />
        <button type="button" onClick={() => setTab('chat')} className={`border border-zinc-700 px-4 py-2 ${tab === 'chat' ? 'text-emerald-400' : 'text-zinc-500'}`}>CONVENTIONAL CHAT</button>
        <button type="button" onClick={() => setTab('agent')} className={`border border-zinc-700 px-4 py-2 ${tab === 'agent' ? 'text-emerald-400' : 'text-zinc-500'}`}>DISTRIBUTED AGENT</button>
      </div>
      {tab === 'chat' ? <div className="border border-zinc-800 p-5 text-zinc-500">Standard SecOps static review panel active. Please switch tabs to access the automated cluster.</div> : <AgentPanel accessCode={code} />}
    </div>
  );
}
