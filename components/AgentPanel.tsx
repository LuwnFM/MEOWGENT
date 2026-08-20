'use client';

import React, { useState, useEffect, useRef } from 'react';

type TaskStatus = 'offline' | 'pending' | 'running' | 'completed' | 'failed';
type StealthLevel = 'low' | 'standard' | 'maximum';

type Task = { 
  instruction: string; 
  status: TaskStatus; 
  statusText: string;
  cacheHit?: boolean;
  stealthMode?: StealthLevel;
};

type AgentResponse = {
  task?: Task | null;
};

export default function AgentPanel({ accessCode }: { accessCode: string }) {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<TaskStatus>('offline');
  const [text, setText] = useState('System ready. Distributed multi-provider cascade listening.');
  const [stealth, setStealth] = useState<StealthLevel>('standard');
  const [cacheDetected, setCacheDetected] = useState(false);
  const [load, setLoad] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  
  // Хранилище логов для экспорта в репорт
  const [historyLogs, setHistoryLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const sync = async () => {
    if (!accessCode) {
      setStatus('offline');
      setText('🔒 ОЖИДАНИЕ КЛЮЧА ДОСТУПА ДЛЯ ПОДКЛЮЧЕНИЯ К КЛАСТЕРУ...');
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
        setCacheDetected(!!data.task.cacheHit);
        
        // Логируем уникальные изменения статусов для отчета
        setHistoryLogs(prev => {
          if (prev[prev.length - 1] !== data.task?.statusText) {
            return [...prev, `[${new Date().toLocaleTimeString()}] [${data.task?.status.toUpperCase()}] ${data.task?.statusText}`];
          }
          return prev;
        });
      }
    } catch {
      setStatus('offline');
      setText('⚠️ Сбой шлюза. Локальный воркер на ПК недоступен.');
    }
  };

  useEffect(() => {
    void sync();
    const interval = window.setInterval(() => void sync(), 4000);
    return () => window.clearInterval(interval);
  }, [accessCode]);

  // Автопрокрутка логов на экране смартфона
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [text]);

  const run = async () => {
    const trimmedInstruction = instruction.trim();
    
    // МАКСИМАЛЬНАЯ ВАЛИДАЦИЯ ПЕРЕД ОТПРАВКОЙ
    if (!trimmedInstruction) return;
    if (!accessCode) {
      alert('Ошибка: Отсутствует ключ авторизации!');
      return;
    }

    setLoad(true);
    setCacheDetected(false);
    // Очищаем прошлые логи перед новой сессией
    setHistoryLogs([`[${new Date().toLocaleTimeString()}] [PENDING] Инициализация нового полетного задания...`]);

    try {
      const fileKeys: string[] = [];
      for (const file of files) {
        const signResponse = await fetch('/api/files', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessCode, filename: file.name, contentType: file.type }),
        });
        if (!signResponse.ok) throw new Error('Не удалось получить ссылку S3 для файла.');
        const signed = await signResponse.json() as { key: string; url: string };
        const uploadResponse = await fetch(signed.url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!uploadResponse.ok) throw new Error(`Не удалось загрузить файл ${file.name}.`);
        fileKeys.push(signed.key);
      }
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessCode, 
          action: 'SET_TASK', 
          instruction: trimmedInstruction,
          stealthLevel: stealth // Передаем выбранный уровень скрытности в API
          , fileKeys
        }),
      });
      if (!response.ok) throw new Error('Task submission aborted');
      setStatus('pending');
      setText('Спецификация отправлена. Распределенная сеть вычисляет маршруты провайдеров...');
      setInstruction('');
      setFiles([]);
      setFileError('');
    } catch {
      setStatus('failed');
      setText('Критическая ошибка: Не удалось доставить таску на сервер.');
    } finally {
      setLoad(false);
    }
  };

  // ФУНКЦИЯ МГНОВЕННОГО ЭКСПОРТА СЕССИИ В MARKDOWN (.md) С ТЕЛЕФОНА
  const exportSessionToMarkdown = () => {
    const markdownContent = `# SECOPS CLUSTER AUDIT REPORT
Generated: ${new Date().toLocaleString()}
Status: ${status.toUpperCase()}
Stealth Execution Profile: ${stealth.toUpperCase()}
Database Cache Status: ${cacheDetected ? 'NEON DB CACHE HIT' : 'NEW PROTOCOL GENERATED'}

## EXECUTION DIRECTIVE
\`\`\`text
${text}
\`\`\`

## TIMELINE TELEMETRY LOGS
${historyLogs.map(log => `* ${log}`).join('\n')}

---
*Report exported via Meowgent Core Matrix Interface.*`;

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secops_audit_report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section style={{ background: '#050508', color: '#00ff00', border: '1px solid #005500', padding: '20px', borderRadius: '8px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <h2 style={{ margin: 0, fontSize: '14px', color: '#00ffff', textShadow: '0 0 6px rgba(0,255,255,0.3)' }}>
          ⚡️ MULTI-PROVIDER AGENT TERMINAL
        </h2>
        {cacheDetected && (
          <span style={{ fontSize: '10px', background: '#003333', color: '#00ffff', border: '1px solid #00ffff', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
            💾 NEON DB CACHE
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>
        Cascade: OpenRouter (Primary Brain) ➔ Groq (Pacing Cluster) ➔ Mistral (Vector Embeds)
      </p>

      {/* НОВЫЙ ИНСТРУМЕНТ: ПЕРЕКЛЮЧАТЕЛЬ УРОВНЕЙ СКРЫТНОСТИ ТРАФИКА */}
      <div style={{ marginTop: '15px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #222' }}>
        <span style={{ fontSize: '11px', color: '#888' }}>🛡️ ПРОФИЛЬ СКРЫТНОСТИ (STEALTH PROFILE):</span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          {(['low', 'standard', 'maximum'] as StealthLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setStealth(level)}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                background: stealth === level ? '#003300' : '#050505',
                color: stealth === level ? '#00ff00' : '#444',
                border: stealth === level ? '1px solid #00ff00' : '1px solid #222',
                cursor: 'pointer',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* ТЕКСТОВОЕ ПОЛЕ ЗАДАЧИ */}
      <textarea
        rows={4}
        style={{
          width: '100%',
          background: '#0a0a0f',
          color: '#33ff33',
          border: '1px solid #005500',
          padding: '12px',
          marginTop: '15px',
          borderRadius: '6px',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box'
        }}
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Введите глобальную полетную инструкцию для распределенной сети..."
      />

      <label style={{ display: 'block', marginTop: '10px', color: '#88ff88', fontSize: '12px' }}>
        FILES FOR AGENT
        <input
          type="file"
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []).slice(0, 10);
            setFiles(selected);
            setFileError(selected.length ? '' : '');
          }}
          style={{ display: 'block', marginTop: '6px', width: '100%' }}
        />
      </label>
      {files.length > 0 && <p style={{ fontSize: '11px', color: '#00ffff' }}>{files.length} file(s) queued: {files.map((file) => file.name).join(', ')}</p>}
      {fileError && <p style={{ fontSize: '11px', color: '#ff3333' }}>{fileError}</p>}

      {/* КНОПКА ЗАПУСКА КЛАССИФИКАЦИИ */}
      <button
        type="button"
        onClick={() => void run()}
        disabled={load || !accessCode || !instruction.trim()}
        style={{
          marginTop: '12px',
          width: '100%',
          background: load ? '#111' : '#00ff00',
          color: load ? '#444' : '#000',
          border: load ? '1px solid #222' : 'none',
          padding: '14px',
          fontWeight: 'bold',
          fontSize: '13px',
          cursor: load || !accessCode || !instruction.trim() ? 'not-allowed' : 'pointer',
          borderRadius: '6px',
          textShadow: load ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        {load ? '⚙️ МАРШРУТИЗАЦИЯ И КЭШИРОВАНИЕ...' : '🚀 НАПРАВИТЬ В РАСПРЕДЕЛЕННУЮ СЕТЬ'}
      </button>

      {/* МОНИТОР КОНСОЛЬНЫХ ЛОГОВ (TERMINAL OUTPUT) */}
      <div style={{ marginTop: '20px', borderTop: '2px solid #003300', paddingTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
            NODE STATUS: <span style={{ color: status === 'completed' ? '#00ffff' : (status === 'failed' ? '#ff3333' : '#ffff00') }}>{status.toUpperCase()}</span>
          </span>
          
          {/* НОВАЯ КНОПКА: ЭКСПОРТ В MARKDOWN */}
          {historyLogs.length > 1 && (
            <button
              type="button"
              onClick={exportSessionToMarkdown}
              style={{ background: 'none', border: '1px solid #00ffff', color: '#00ffff', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}
            >
              📥 СКАЧАТЬ .MD ОТЧЕТ
            </button>
          )}
        </div>

        {/* ОКНО ЖИВОГО ТЕРМИНАЛА С АВТОПРОКРУТКОЙ */}
        <div style={{
          background: '#020205',
          border: '1px solid #002200',
          borderRadius: '4px',
          padding: '10px',
          height: '110px',
          overflowY: 'auto',
          fontSize: '12px',
          color: '#88ff88',
          lineHeight: '1.4'
        }}>
          {historyLogs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid #001100', paddingBottom: '2px' }}>{log}</div>
          ))}
          <div ref={logEndRef} />
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#444' }}>LOG_STREAM: {text}</p>
      </div>
    </section>
  );
}
