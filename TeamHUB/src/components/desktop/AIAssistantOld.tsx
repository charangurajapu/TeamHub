import React, { useState } from 'react';
import { User, ViewMode } from '../../types';
import { generateGeminiAssistantResponse } from '../../lib/gemini';
import { AiDocPreviewPanel } from '../common/AiDocPreviewPanel';
import { useSidebar } from '../../context/SidebarContext';

interface AIAssistantOldProps {
  currentUser: User;
  onNavigate: (view: ViewMode) => void;
}

export const AIAssistantOld: React.FC<AIAssistantOldProps> = ({ currentUser, onNavigate }) => {
  const { isCollapsed } = useSidebar();
  const [activeSession, setActiveSession] = useState('sprint-42');
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'm-1',
      sender: 'user',
      text: 'Can you summarize what the team accomplished yesterday on the onboarding redesign, and list any outstanding questions?',
      time: 'Yesterday at 5:42 PM',
    },
    {
      id: 'm-2',
      sender: 'ai',
      text: "Here is the summary of yesterday's onboarding progress based on 6 updates in #design and #frontend:",
      time: 'Yesterday at 5:42 PM',
      isStructured: true,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [taskCreated, setTaskCreated] = useState(false);
  const [draftAnswerMode, setDraftAnswerMode] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isThinking) return;

    setErrorMessage(null);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text, time: 'Just now' },
    ]);
    setInputVal('');
    setIsThinking(true);

    // Build chat history for Gemini context
    const history = messages.map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
      text: m.text,
    }));

    const result = await generateGeminiAssistantResponse(text, history);
    setIsThinking(false);

    if (result.error) {
      setErrorMessage(result.error);
    }

    const aiResponseText = result.text || 'Sorry, I was unable to generate a response.';

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiResponseText,
        time: 'Just now',
      },
    ]);
  };

  return (
    <div className="flex flex-col w-full gap-6">
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left History & Context Panel (4 cols) */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#ffffff] rounded-2xl shadow-xs border border-[#eaedff] p-4 flex flex-col gap-4">
            <button
              onClick={() => {
                setActiveSession('new');
                setMessages([
                  {
                    id: 'm-new',
                    sender: 'ai',
                    text: 'New session started. How can I assist you with team engineering questions or sprint planning?',
                    time: 'Just now',
                  },
                ]);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#f2f3ff] text-xs font-semibold text-[#131b2e] hover:bg-[#eaedff] hover:text-[#006b2c] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Conversation</span>
            </button>

            {/* Sessions */}
            <div className="space-y-1">
              <span className="px-2 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block mb-1">
                Recent Insights & Queries
              </span>

              {[
                { id: 'sprint-42-doc', title: 'Sprint 42 Documentation (Draft)', time: 'Just now', isDoc: true },
                { id: 'sprint-42', title: 'Sprint 42 Deliverables Summary', time: 'Just now' },
                { id: 'redis-policy', title: 'Redis Cache Policy Solution', time: '2h ago' },
                { id: 'tokens-plan', title: 'Design Tokens Refactoring Plan', time: 'Yesterday' },
                { id: 'blocker-digest', title: 'Weekly Team Blocker Digest', time: '3d ago' },
              ].map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => {
                    if (sess.isDoc) {
                      setShowDocPreview(true);
                    } else {
                      setActiveSession(sess.id);
                      setShowDocPreview(false);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                    (sess.isDoc && showDocPreview) || (!showDocPreview && activeSession === sess.id)
                      ? 'bg-[#eaedff] text-[#006b2c] font-semibold'
                      : 'text-[#3e4a3d] hover:bg-[#f2f3ff]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        (sess.isDoc && showDocPreview) || (!showDocPreview && activeSession === sess.id)
                          ? 'bg-[#006b2c]'
                          : 'bg-transparent'
                      }`}
                    ></span>
                    <span className="truncate">{sess.title}</span>
                  </div>
                  <span className="text-[10px] text-[#6e7b6c] shrink-0">{sess.time}</span>
                </div>
              ))}
            </div>

            {/* Connected Sources */}
            <div className="space-y-2 pt-2 border-t border-[#eaedff]">
              <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold text-[#6e7b6c]">
                <span>Knowledge Sources</span>
                <span className="text-[#006b2c] font-semibold">Active</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {['Channels', 'Tasks', 'Figma', 'GitHub'].map((src) => (
                  <div key={src} className="p-2 rounded-xl bg-[#f2f3ff] flex items-center justify-between">
                    <span className="text-xs font-medium text-[#131b2e]">{src}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vector Store Capacity */}
            <div className="p-3 rounded-xl bg-[#faf8ff] border border-[#eaedff] flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#3e4a3d]">Semantic Index</span>
                <span className="text-[10px] font-bold text-[#006b2c]">74% Synced</span>
              </div>
              <div className="w-full bg-[#eaedff] h-1 rounded-full overflow-hidden">
                <div className="bg-[#006b2c] h-full rounded-full" style={{ width: '74%' }}></div>
              </div>
              <span className="text-[10px] text-[#6e7b6c]">38 Docs, 142 Threads embedded</span>
            </div>
          </div>
        </aside>

        {/* Right Active Conversation & Intelligence Area (8 cols) */}
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {/* Header Card */}
          <div className="bg-[#ffffff] rounded-2xl shadow-xs border border-[#eaedff] p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[#131b2e] tracking-tight">AI Assistant</h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#7ffc97] text-[#005320] text-[10px] font-bold">
                    Workspace Context
                  </span>
                </div>
                <p className="text-xs text-[#6e7b6c] mt-0.5">
                  Connected to Workspace Knowledge Base (4 Channels, 38 Docs)
                </p>
              </div>
            </div>

            {/* Action Chips */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <button
                onClick={() => setShowDocPreview(true)}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px] text-[#7ffc97]">magic_button</span>
                <span>Document our teamwork</span>
              </button>
              <button
                onClick={() => handleSend("Summarize today's updates")}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] text-xs font-medium text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#006b2c]">auto_awesome</span>
                <span>Summarize today's updates</span>
              </button>
              <button
                onClick={() => handleSend('Draft task from question')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] text-xs font-medium text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#006b2c]">assignment_add</span>
                <span>Draft task from question</span>
              </button>
              <button
                onClick={() => handleSend('Identify blockers')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] text-xs font-medium text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#006b2c]">warning_amber</span>
                <span>Identify blockers</span>
              </button>
            </div>
          </div>

          {/* Chat Stream */}
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-[#006b2c] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
                    AI
                  </div>
                )}

                <div
                  className={`flex flex-col gap-2 max-w-2xl ${
                    msg.sender === 'user' ? 'items-end' : 'items-start w-full'
                  }`}
                >
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#006b2c] text-white rounded-tr-xs shadow-xs'
                        : 'bg-[#ffffff] text-[#131b2e] border border-[#eaedff] rounded-tl-xs shadow-xs w-full'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {msg.isStructured && (
                      <div className="mt-3 space-y-2.5">
                        {/* Highlights */}
                        <div className="p-3 rounded-xl bg-[#f2f3ff] flex items-start gap-2.5 border border-[#eaedff]">
                          <span className="material-symbols-outlined text-[#006b2c] text-[18px]">palette</span>
                          <div className="flex-1">
                            <span className="font-bold text-[#131b2e]">
                              Marcus completed high-fidelity user flows for customer onboarding v2.4.
                            </span>
                            <span className="text-[10px] text-[#6e7b6c] block mt-0.5">
                              Figma: "Onboarding Flow v2.4" • Updated 4:15 PM
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#f2f3ff] flex items-start gap-2.5 border border-[#eaedff]">
                          <span className="material-symbols-outlined text-[#006b2c] text-[18px]">terminal</span>
                          <div className="flex-1">
                            <span className="font-bold text-[#131b2e]">
                              David verified API payload contracts for auth endpoints.
                            </span>
                            <span className="text-[10px] text-[#6e7b6c] block mt-0.5">
                              PR #388: "feat(auth): validate onboarding claims payload" • Merged
                            </span>
                          </div>
                        </div>

                        {/* Outstanding question action box */}
                        <div className="p-4 rounded-xl bg-[#f2f3ff] border border-[#eaedff] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#131b2e] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[#8d4b00] text-[18px]">help</span>
                              1 Outstanding Team Question
                            </span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] bg-[#eaedff] text-[#3e4a3d] font-semibold">
                              To Do
                            </span>
                          </div>
                          <p className="text-xs text-[#3e4a3d] bg-white p-2.5 rounded-lg border border-[#eaedff]">
                            "TanStack Virtual vs react-window benchmarks for 10k activity feed items."
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                setDraftAnswerMode(true);
                                handleSend("Draft answer comparing TanStack Virtual and react-window");
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all shadow-xs cursor-pointer"
                            >
                              Draft Answer with AI
                            </button>
                            <button
                              onClick={() => {
                                setTaskCreated(true);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-[#eaedff] ${
                                taskCreated ? 'bg-[#7ffc97] text-[#005320]' : 'bg-white text-[#131b2e] hover:bg-[#eaedff]'
                              }`}
                            >
                              {taskCreated ? 'Task Created (#429) ✓' : 'Convert to Task'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-[#6e7b6c] pr-1">{msg.time}</span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#eaedff] text-[#006b2c] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
                    SC
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Floating Prompt Bar */}
          <div className="sticky bottom-6 z-20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="bg-[#ffffff] rounded-2xl shadow-lg border border-[#eaedff] p-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask AI Assistant about team progress, code, or documentation..."
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Stitch Slide-out AI Documentation Preview Panel with Backdrop */}
      {showDocPreview && (
        <>
          <div
            id="backdrop"
            className={`fixed inset-0 top-16 left-0 ${
              isCollapsed ? 'lg:left-[72px]' : 'lg:left-[260px]'
            } bg-[#131b2e]/25 backdrop-blur-[2px] z-40 transition-all duration-300 ease-in-out animate-in fade-in cursor-pointer`}
            onClick={() => setShowDocPreview(false)}
          />
          <div
            className="fixed top-16 right-0 h-[calc(100vh-64px)] w-full sm:w-[580px] z-50 flex flex-col animate-in slide-in-from-right duration-300 ease-out shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AiDocPreviewPanel
              currentUser={currentUser}
              onClose={() => setShowDocPreview(false)}
              onBackToChat={() => setShowDocPreview(false)}
              onNavigateToFiles={() => onNavigate('files')}
              isDrawerMode={true}
            />
          </div>
        </>
      )}
    </div>
  );
};
