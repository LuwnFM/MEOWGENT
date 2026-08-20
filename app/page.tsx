'use client';

import React, { useState, useEffect } from 'react';
import AgentPanel from '@/components/AgentPanel';

export default function MainPage() {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'chat' | 'agent'>('chat');
  const [isAuthSaved, setIsAuthSaved] = useState(false);

  // Восстановление токена из локального хранилища устройства при загрузке
  useEffect(() => {
    const savedCode = localStorage.getItem('app_access_token');
    if (savedCode) {
      setCode(savedCode);
      setIsAuthSaved(true);
    }
  }, []);

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

  return (
    <div style={{
      background: '#0a0a0c',
      minHeight: '100vh',
      color: '#33ff33',
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
          <div style={{
            background: '#111115',
            border: '1px solid #222',
            borderRadius: '6px',
            padding: '20px',
            color: '#666',
            textAlign: 'center',
            fontSize: '14px',
            marginTop: '40px'
          }}>
            <p style={{ color: '#888', margin: '0 0 10px 0' }}>[ СТАТИЧЕСКИЙ АНАЛИЗАТОР СРЕДЫ ]</p>
            Интерфейс стандартного текстового чата находится в режиме ожидания. 
            Переключите вкладку сверху на <strong>DISTRIBUTED AGENT</strong> для управления распределенным сетевым кластером.
          </div>
        ) : (
          <AgentPanel accessCode={code} />
        )}
      </main>
    </div>
  );
}
