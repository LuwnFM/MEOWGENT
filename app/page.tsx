'use client';

import { useState, useEffect, useRef } from 'react';
import AgentPanel from '@/components/AgentPanel';
import { Shield, Send, Terminal, Key, ShieldAlert, Code2, Download } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [model, setModel] = useState('z-ai/glm-5.2:free');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState<'chat' | 'agent'>('chat');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCode = localStorage.getItem('secops_access_code');
    if (savedCode) setAccessCode(savedCode);
  }, []);

  const saveCode = (code: string) => {
    setAccessCode(code);
    localStorage.setItem('secops_access_code', code);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setErrorMsg('');
    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          model,
          accessCode
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'INVALID_ACCESS_CODE') {
          setErrorMsg('Ошибка: Неверный "Ключ доступа к панели" в настройках!');
        } else {
          setErrorMsg(data.message || data.details || 'Неизвестная ошибка провайдера.');
        }
        setMessages(messages); // rollback
      } else {
        const reply = data.choices?.[0]?.message?.content || 'Нет ответа от модели';
        setMessages([...newMessages, { role: 'assistant', content: reply }]);
      }
    } catch (err: any) {
      setErrorMsg('Критическая ошибка сети или сервера.');
    } finally {
      setLoading(false);
    }
  };

  const exportSession = () => {
    const text = messages.map(m => `### [${m.role.toUpperCase()}]\n${m.content}\n\n`).join('');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secops_session_${Date.now()}.md`;
    a.click();
  };

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-2 sm:p-4 selection:bg-red-900 selection:text-white">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 border border-zinc-800 bg-zinc-950 rounded-xl mb-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-950 text-red-500 rounded-lg border border-red-900 animate-pulse">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-zinc-100 tracking-wider flex items-center gap-2">
              SECOPS CORE TERMINAL <span className="text-xs font-mono px-1.5 py-0.5 bg-red-900/30 text-red-400 border border-red-800 rounded">BYPASS MODULE ACTIVE</span>
            </h1>
            <p className="text-xs text-zinc-500">Локальный запуск ИИ без цензуры (GLM 5.2 / Qwen-2.5)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <button type="button" onClick={() => setTab('chat')} className={tab === 'chat' ? 'text-emerald-400' : 'text-zinc-500'}>CHAT</button>
          <button type="button" onClick={() => setTab('agent')} className={tab === 'agent' ? 'text-emerald-400' : 'text-zinc-500'}>AGENT</button>
          <button onClick={exportSession} className="p-2 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg bg-zinc-900 text-xs flex items-center gap-1.5 transition-all">
            <Download className="w-3.5 h-3.5" /> Экспорт
          </button>
        </div>
      </header>

      {tab === 'agent' ? <AgentPanel accessCode={accessCode} /> : (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 overflow-hidden min-h-0">
        {/* Sidebar Configuration */}
        <div className="md:col-span-1 border border-zinc-800 bg-zinc-950 p-4 rounded-xl flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center gap-2 text-zinc-300 font-bold border-b border-zinc-900 pb-2 text-xs uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-emerald-500" /> Параметры Ядра
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-zinc-500" /> Ключ доступа к панели
            </label>
            <input
              type="password"
              placeholder="Введи APP_ACCESS_CODE"
              value={accessCode}
              onChange={(e) => saveCode(e.target.value)}
              className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-red-800 transition-all font-sans"
            />
            <p className="text-[10px] text-zinc-600">Защищает ваш шлюз Vercel от посторонних запросов.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5 text-zinc-500" /> Модель (Open-Weights)
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-emerald-800 cursor-pointer"
            >
              <option value="z-ai/glm-5.2:free">Z.ai: GLM-5.2 (Free/Бесплатно)</option>
              <option value="qwen/qwen-2.5-72b-instruct">Qwen 2.5: Coder 72B (Instruct)</option>
              <option value="deepseek/deepseek-r1">DeepSeek: R1 (Reasoning)</option>
            </select>
          </div>

          <div className="mt-auto border border-red-950 bg-red-950/10 p-3 rounded-lg flex gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              <b className="text-zinc-200 block mb-0.5">Внимание:</b> Системные инъекции принудительно переопределяют веса. Все ответы выдаются напрямую без постобработки безопасности. Используйте строго легально.
            </div>
          </div>
        </div>

        {/* Chat Terminal Zone */}
        <div className="md:col-span-3 border border-zinc-800 bg-zinc-950 rounded-xl flex flex-col overflow-hidden shadow-xl">
          {/* Messages Node */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs sm:text-sm">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-600">
                <Terminal className="w-12 h-12 text-zinc-800 mb-2 stroke-[1]" />
                <p className="font-bold text-zinc-500 mb-1 text-xs sm:text-sm">ТЕРМИНАЛ ГОТОВ К ПРИЕМУ ДАННЫХ</p>
                <p className="text-[11px] max-w-sm">Отправьте логи веб-сервера, исходный код функций или запросите сборку PoC. Цензура полностью отключена на уровне бэкенд-шлюза.</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`p-3.5 rounded-lg border leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100' 
                    : 'bg-zinc-950 border-zinc-900 text-emerald-400 selection:bg-emerald-950'
                }`}>
                  <div className={`font-bold mb-1.5 text-[11px] tracking-widest ${msg.role === 'user' ? 'text-zinc-400' : 'text-emerald-500'}`}>
                    [{msg.role.toUpperCase()}]
                  </div>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-lg text-zinc-500 animate-pulse text-xs">
                [COMPUTING...] Матрица весов производит декриптинг и анализ структуры запроса...
              </div>
            )}
            {errorMsg && (
              <div className="p-3 bg-red-950/30 border border-red-900 rounded-lg text-red-400 text-xs">
                {errorMsg}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Node */}
          <form onSubmit={handleSend} className="p-3 bg-zinc-900/40 border-t border-zinc-900 flex gap-2">
            <input
              type="text"
              placeholder="Вставьте лог, код или задачу на пентест..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-zinc-700 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-white text-black font-bold rounded-lg disabled:opacity-40 disabled:hover:bg-zinc-100 transition-all flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
