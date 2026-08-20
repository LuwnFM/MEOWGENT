'use client';

import React, { useEffect, useRef, useState } from 'react';
import AgentPanel from '@/components/AgentPanel';

type Message = { role: 'user' | 'system'; text: string; time: string };

export default function MainPage() {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'chat' | 'agent'>('chat');
  const [isAuthSaved, setIsAuthSaved] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', text: 'SYSTEM: SecOps Static Analyzer Node Online. Ready for source code inspection.', time: new Date().toLocaleTimeString() }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Восстановление токена из локального хранилища устройства при загрузке
  useEffect(() => {
    const savedCode = localStorage.getItem('app_access_token');
    if (savedCode) {
      setCode(savedCode);
      setIsAuthSaved(true);
    }
  }, []);

  const handleSaveCode = (val: string) => {
    const trimmedCode = val.trim();
    setCode(val);
    if (trimmedCode) {
      localStorage.setItem('app_access_token', trimmedCode);
    } else {
      localStorage.removeItem('app_access_token');
    }
    setIsAuthSaved(Boolean(trimmedCode));
  };

  const handleClearCode = () => {
    setCode('');
    localStorage.removeItem('app_access_token');
    setIsAuthSaved(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !isAuthSaved) return;

    setMessages((previous) => [...previous, {
      role: 'user',
      text,
      time: new Date().toLocaleTimeString()
    }]);
    setChatInput('');

    window.setTimeout(() => {
      setMessages((previous) => [...previous, {
        role: 'system',
        text: '[ANALYSIS] Input accepted. Syntax boundaries checked. No errors detected. Switch to DISTRIBUTED AGENT to dispatch a task to the execution cluster.',
        time: new Date().toLocaleTimeString()
      }]);
    }, 1200);
  };

  return (
    <div style={{
      background: '#050505',
      minHeight: '100vh',
      color: '#00ff00',
      padding: '15px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      boxSizing: 'border-box'
    }}>
      {/* ПАНЕЛЬ НАВИГАЦИИ */}
      <header style={{
        borderBottom: '2px solid #005500',
        paddingBottom: '15px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#00ffff', textShadow: '0 0 8px rgba(0,255,255,0.4)' }}>
            M E O W G E N T // CORE
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button"
              onClick={() => setTab('chat')} 
              style={{
                padding: '8px 16px',
                background: tab === 'chat' ? '#003300' : '#111',
                border: tab === 'chat' ? '1px solid #33ff33' : '1px solid #222',
                color: tab === 'chat' ? '#33ff33' : '#666',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              [ CONVENTIONAL CHAT ]
            </button>
            <button 
              type="button"
              onClick={() => setTab('agent')} 
              style={{
                padding: '8px 16px',
                background: tab === 'agent' ? '#003300' : '#111',
                border: tab === 'agent' ? '1px solid #33ff33' : '1px solid #222',
                color: tab === 'agent' ? '#33ff33' : '#666',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              [ DISTRIBUTED AGENT ]
            </button>
          </div>
        </div>
      </header>

      {/* БЛОК СЕКРЕТНОГО КОДА ДОСТУПА */}
      <section style={{
        background: '#111115',
        border: '1px solid #224422',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>🔐 КЛЮЧ ДОСТУПА К СИСТЕМЕ:</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="password"
            placeholder="ENTER APP ACCESS CODE..."
            style={{
              flex: 1,
              background: '#050507',
              color: '#33ff33',
              border: isAuthSaved ? '1px solid #005500' : '1px solid #ff3333',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '14px',
              outline: 'none'
            }}
            value={code}
            onChange={(e) => handleSaveCode(e.target.value)}
          />
          {isAuthSaved && (
            <button 
              type="button"
              onClick={handleClearCode}
              style={{
                background: '#330000',
                color: '#ff3333',
                border: '1px solid #ff3333',
                padding: '0 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              RESET
            </button>
          )}
        </div>
      </section>

      {/* КОНТЕНТ ВКЛАДОК */}
      <main style={{ minHeight: '60vh' }}>
        {tab === 'chat' ? (
          <div style={{ background: '#050505', border: '1px solid #005500', padding: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#00ff00', fontSize: '13px' }}>INTERACTIVE DIAGNOSTIC CHAT</h4>
            <div style={{ background: '#050505', border: '1px solid #005500', padding: '10px', height: '220px', overflowY: 'auto', fontSize: '13px', marginBottom: '12px' }}>
              {messages.map((message, index) => (
                <div key={`${message.time}-${index}`} style={{ marginBottom: '8px', borderBottom: '1px solid #005500', paddingBottom: '4px', color: message.role === 'user' ? '#00ffff' : '#00ff00' }}>
                  <span style={{ color: '#666', fontSize: '11px' }}>[{message.time}]</span>{' '}
                  <strong>{message.role.toUpperCase()}:</strong> {message.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                disabled={!isAuthSaved}
                placeholder={isAuthSaved ? 'Enter a code or question for an express check...' : 'Enter the access code above to unlock the console'}
                style={{ flex: '1 1 220px', minWidth: 0, background: '#050505', color: '#00ff00', border: '1px solid #005500', padding: '10px', outline: 'none' }}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSendChatMessage()}
              />
              <button
                type="button"
                disabled={!isAuthSaved || !chatInput.trim()}
                onClick={handleSendChatMessage}
                style={{ background: isAuthSaved && chatInput.trim() ? '#00ff00' : '#005500', color: '#000', border: '1px solid #005500', padding: '0 20px', fontWeight: 'bold', cursor: isAuthSaved && chatInput.trim() ? 'pointer' : 'not-allowed' }}
              >
                SEND
              </button>
            </div>
          </div>
        ) : (
          <AgentPanel accessCode={code} />
        )}
      </main>
    </div>
  );
}
