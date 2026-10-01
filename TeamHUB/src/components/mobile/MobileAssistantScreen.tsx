import React, { useState } from 'react';

export const MobileAssistantScreen: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    {
      sender: 'ai',
      text: 'Good morning! I am your TeamHub AI assistant. I can summarize thread decisions, draft your daily standup, or pull architecture specs from GitHub.',
      time: '10:00 AM',
    },
    {
      sender: 'user',
      text: 'What are the main blockers across the Core Engineering pod today?',
      time: '10:02 AM',
    },
    {
      sender: 'ai',
      text: 'David Kim is currently blocked on RFC-108 awaiting architecture sign-off for Redis cache failovers. All other pod members are on track.',
      time: '10:02 AM',
    },
  ]);

  const [input, setInput] = useState('');

  const handleSend = (textToSend?: string) => {
    const val = (textToSend || input).trim();
    if (!val) return;

    setMessages((prev) => [...prev, { sender: 'user', text: val, time: 'Just now' }]);
    setInput('');

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Verified against Sprint 42 repository and active channels:
All 18 delivered tasks pass automated regression testing. The next CI deploy is scheduled for 18:00 UTC.`,
          time: 'Just now',
        },
      ]);
    }, 600);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#faf8ff] pb-28 text-[#131b2e]">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-[#faf8ff]/85 backdrop-blur-xl shadow-xs px-4 py-3 flex items-center justify-between border-b border-[#eaedff]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#006b2c] text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#131b2e]">TeamHub AI</span>
            <span className="text-[10px] text-[#006b2c] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
              Connected to Core Pod
            </span>
          </div>
        </div>
      </header>

      {/* Suggested chips */}
      <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#eaedff] bg-white">
        <button
          onClick={() => handleSend('Draft my daily standup')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-[#f2f3ff] text-xs font-medium text-[#131b2e] active:scale-95 transition-all"
        >
          Draft my standup
        </button>
        <button
          onClick={() => handleSend('Summarize blockers in #backend')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-[#f2f3ff] text-xs font-medium text-[#131b2e] active:scale-95 transition-all"
        >
          Summarize blockers
        </button>
        <button
          onClick={() => handleSend('Show PR #412 summary')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-[#f2f3ff] text-xs font-medium text-[#131b2e] active:scale-95 transition-all"
        >
          PR #412 specs
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-[#006b2c] text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs mt-1">
                AI
              </div>
            )}
            <div
              className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                m.sender === 'user'
                  ? 'bg-[#006b2c] text-white rounded-tr-xs'
                  : 'bg-[#ffffff] text-[#131b2e] border border-[#eaedff] rounded-tl-xs shadow-xs'
              }`}
            >
              {m.text}
              <div
                className={`text-[9px] mt-1 text-right ${
                  m.sender === 'user' ? 'text-white/80' : 'text-[#6e7b6c]'
                }`}
              >
                {m.time}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Input */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-[#faf8ff] border-t border-[#eaedff]">
        <div className="flex items-center gap-2 bg-[#ffffff] border border-[#eaedff] rounded-2xl p-1.5 shadow-sm">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI anything about tasks or channels..."
            className="flex-1 px-2.5 py-1 text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none"
          />
          <button
            onClick={() => handleSend()}
            className="w-8 h-8 rounded-xl bg-[#006b2c] text-white flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <span className="material-symbols-outlined text-[17px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
