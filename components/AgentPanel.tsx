'use strict';
import React, { useState, useEffect } from 'react';

export default function AgentPanel({ accessCode }: { accessCode: string }) {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState('offline');
  const [text, setText] = useState('Нет активных задач.');
  const [load, setLoad] = useState(false);

  const sync = async () => {
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
    if (!instruction) return;
    setLoad(true);
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, action: 'SET_TASK', instruction })
      });
      setStatus('pending');
    } catch (e) {} finally { setLoad(false); }
  };

  return (
    <div style={{ background: '#050505', color: '#0f0', padding: '15px', fontFamily: 'monospace' }}>
      <h4>STEALTH AGENT CONTROL</h4>
      <textarea rows={3} style={{ width: '100%', background: '#111', color: '#0f0', border: '1px solid #0f0' }} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Полетное задание для автоматизации..." />
      <button onClick={run} disabled={load} style={{ marginTop: '10px', width: '100%', background: '#0f0', color: '#000' }}>EXECUTE</button>
      <div style={{ marginTop: '15px', borderTop: '1px solid #222' }}>
        <p>STATUS: {status.toUpperCase()}</p>
        <p style={{ color: '#888' }}>LOG: {text}</p>
      </div>
    </div>
  );
}
