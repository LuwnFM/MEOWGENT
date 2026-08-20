'use strict';
import React, { useState } from 'react';
import AgentPanel from '@/components/AgentPanel';

export default function MainPage() {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('chat');

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#0f0', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <input type="password" placeholder="ACCESS CODE" style={{ background: '#222', color: '#0f0', border: '1px solid #0f0' }} value={code} onChange={(e) => setCode(e.target.value)} />
        <button onClick={() => setTab('chat')} style={{ marginLeft: '10px', color: tab === 'chat' ? '#0f0' : '#888' }}>CHAT</button>
        <button onClick={() => setTab('agent')} style={{ marginLeft: '10px', color: tab === 'agent' ? '#0f0' : '#888' }}>AGENT</button>
      </div>
      {tab === 'chat' ? (<div>SecOps Chat Active.</div>) : (<AgentPanel accessCode={code} />)}
    </div>
  );
}
