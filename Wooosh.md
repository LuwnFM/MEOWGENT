'use client';

import React, { useState, useEffect, useRef } from 'react';
import AgentPanel from '@/components/AgentPanel';

type Message = { role: 'user' | 'system'; text: string; time: string };

export default function MainPage() {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'chat' | 'agent'>('chat');
  const [isAuthSaved, setIsAuthSaved] = useState(false);
  
  // Состояния для работы легального интерактивного чата
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', text: 'SYSTEM: SecOps Static Analyzer Node Online. Ready for source code inspection.', time: new Date().toLocaleTimeString() }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCode = localStorage.getItem('app_access_token');
    if (savedCode) {
      setCode(savedCode);
      setIsAuthSaved(true);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSaveCode = (val: string) => {
    setCode(val);
    localStorage.setItem('app_access_token', val);
    setIsAuthSaved(true);
  };

  const handleClearCode = () => {
    setCode('');
    localStorage.removeItem('app_access_token');
    setIsAuthSaved(false);
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim() || !isAuthSaved) return;

    const userMsg: Message = {
      role: 'user',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Симуляция локального разбора структуры (для автономной работы без ПК)
    setTimeout(() => {
      const systemResponse: Message = {
        role: 'system',
        text: `[ANALYSIS] Входные данные приняты. Проверка синтаксических границ... Ошибок не обнаружено. Смените вкладку на DISTRIBUTED AGENT для отправки задачи на исполняющие узлы Kali Linux.`,
        time: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, systemResponse]);
    }, 1200);
  };

  return (
    <div style={{
      background: '#0a0a0c',
      minHeight: '100vh',
      color: '#33ff33',
      padding: '15px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      boxSizing: 'border-box'
    }}>
      {/* ВЕРХНЯЯ ПАНЕЛЬ НАВИГАЦИИ */}
      <header style={{ borderBottom: '2px solid #005500', paddingBottom: '15px', marginBottom: '20px' }}>
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

      {/* АВТОРИЗАЦИЯ */}
      <section style={{ background: '#111115', border: '1px solid #224422', borderRadius: '6px', padding: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              style={{ background: '#330000', color: '#ff3333', border: '1px solid #ff3333', padding: '0 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              RESET
            </button>
          )}
        </div>
      </section>

      {/* КОНТЕНТ ВКЛАДОК */}
      <main style={{ minHeight: '60vh' }}>
        {tab === 'chat' ? (
          <div style={{ background: '#050508', border: '1px solid #005500', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#00ffff', fontSize: '13px' }}>💬 INTERACTIVE DIAGNOSTIC CHAT</h4>
            
            {/* ОКНО ВЫВОДА ТЕКСТА ЧАТА */}
            <div style={{ background: '#020205', border: '1px solid #002200', padding: '10px', height: '220px', overflowY: 'auto', fontSize: '13px', borderRadius: '4px', marginBottom: '12px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #001100', paddingBottom: '4px', color: msg.role === 'user' ? '#00ffff' : '#88ff88' }}>
                  <span style={{ color: '#444', fontSize: '11px' }}>[{msg.time}]</span> <strong>{msg.role.toUpperCase()}:</strong> {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* ПОЛЕ ВВОДА СООБЩЕНИЯ ЧАТА */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                disabled={!isAuthSaved}
                placeholder={isAuthSaved ? "Введите код или вопрос для экспресс-проверки..." : "Введи КЛЮЧ ДОСТУПА выше, чтобы разблокировать консоль"}
                style={{ flex: 1, background: '#111', color: '#0f0', border: '1px solid #005500', padding: '10px', borderRadius: '4px', outline: 'none' }}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
              />
              <button
                type="button"
                disabled={!isAuthSaved || !chatInput.trim()}
                onClick={handleSendChatMessage}
                style={{ background: '#00ff00', color: '#000', border: 'none', padding: '0 20px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
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
