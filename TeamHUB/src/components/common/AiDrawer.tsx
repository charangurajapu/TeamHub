import React, { useState, useRef, useEffect } from 'react';
import { USERS } from '../../data/mockData';
import { User } from '../../types';
import { generateGeminiAssistantResponse } from '../../lib/gemini';
import { AiDocPreviewPanel } from './AiDocPreviewPanel';
import { useSidebar } from '../../context/SidebarContext';

interface AiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User;
  onNavigate?: (view: any, itemId?: string) => void;
  onInsertToTask?: (text: string) => void;
  onPostToStandup?: (update: { done: string; doing: string; blocked: string }) => void;
  initialPrompt?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isStructured?: boolean;
}

export const AiDrawer: React.FC<AiDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onNavigate,
  onInsertToTask,
  onPostToStandup,
  initialPrompt,
}) => {
  const { isCollapsed } = useSidebar();
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'user',
      text: 'Can you summarize the key decisions in this Redis TTL failover discussion and draft what I should test next?',
      timestamp: '10:32 AM',
    },
    {
      id: 'm-2',
      sender: 'ai',
      text: 'David Kim confirmed the resolution for the TTL race condition encountered during node failovers. The pod agreed to replace client-side renew loops with an atomic Lua script deployed directly to Redis proxy nodes.',
      timestamp: '10:32 AM',
      isStructured: true,
    },
    {
      id: 'm-3',
      sender: 'user',
      text: 'Draft my daily update based on this.',
      timestamp: '10:34 AM',
    },
    {
      id: 'm-4',
      sender: 'ai',
      text: 'Ready for Daily Standup:\nDONE: Verified consensus with David Kim on atomic Lua scripts to eliminate Redis TTL race conditions during failover.\nDOING: Configuring synthetic 250ms NTP jitter load test for secondary proxy failover under 50k writes/sec.\nBLOCKED: None.',
      timestamp: '10:34 AM',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const chatStreamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialPrompt) {
      setInputPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isThinking) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsThinking(true);

    const history = messages.map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
      text: m.text,
    }));

    const result = await generateGeminiAssistantResponse(text, history);
    setIsThinking(false);

    const aiText = result.error || result.text || 'Unable to generate response from Gemini API.';

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiText,
        timestamp: 'Just now',
      },
    ]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (showDocPreview) {
    return (
      <>
        {/* Semi-transparent interactive backdrop overlay */}
        <div
          className={`fixed inset-0 top-16 left-0 ${
            isCollapsed ? 'lg:left-[72px]' : 'lg:left-[260px]'
          } bg-[#131b2e]/25 backdrop-blur-[2px] z-40 transition-all duration-300 ease-in-out animate-in fade-in cursor-pointer`}
          onClick={onClose}
        />

        {/* Slide-out AI Assistant Document Drawer matching Stitch layout */}
        <div
          className="fixed top-16 right-0 h-[calc(100vh-64px)] w-full sm:w-[580px] z-50 flex flex-col animate-in slide-in-from-right duration-300 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          <AiDocPreviewPanel
            currentUser={currentUser || USERS.anya}
            onClose={onClose}
            onBackToChat={() => setShowDocPreview(false)}
            onNavigateToFiles={(fileId) => {
              onClose();
              if (onNavigate) {
                onNavigate('files', fileId);
              }
            }}
            isDrawerMode={true}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Semi-transparent interactive backdrop overlay */}
      <div
        className={`fixed inset-0 top-16 left-0 ${
          isCollapsed ? 'lg:left-[72px]' : 'lg:left-[260px]'
        } bg-[#131b2e]/25 backdrop-blur-[2px] z-40 transition-all duration-300 ease-in-out animate-in fade-in`}
        onClick={onClose}
      />

      {/* Slide-out AI Assistant Drawer (480px width) */}
      <aside
        aria-label="TeamHub AI Assistant Panel"
        className="fixed top-16 right-0 h-[calc(100vh-64px)] w-full sm:w-[480px] bg-[#ffffff] z-50 shadow-2xl flex flex-col justify-between border-l border-[#eaedff] animate-in slide-in-from-right duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Drawer Header */}
        <div className="p-5 bg-[#ffffff] border-b border-[#eaedff] flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#7ffc97] flex items-center justify-center text-[#006b2c] shadow-xs">
                <span className="material-symbols-outlined text-[19px]">auto_awesome</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-[#131b2e] tracking-tight">TeamHub AI Assistant</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-[#7ffc97]/40 text-[#005320] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: 'new-1',
                      sender: 'ai',
                      text: 'New session initialized. How can I assist you with current engineering sprints, tasks, or docs?',
                      timestamp: 'Just now',
                    },
                  ])
                }
                className="p-1.5 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <span className="material-symbols-outlined text-[19px]">refresh</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#6e7b6c] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>
          {/* Pod Connection Info */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#6e7b6c] pl-0.5 mt-0.5">
            <span className="material-symbols-outlined text-[14px] text-[#006b2c]">neurology</span>
            <span className="truncate">Connected to Core Engineering Pod repository & verified solutions</span>
          </div>
        </div>

        {/* 2. Suggestion Quick Action Chips */}
        <div className="px-5 py-2.5 bg-[#faf8ff] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 border-b border-[#eaedff]">
          <button
            onClick={() => setShowDocPreview(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#006b2c]/10 hover:bg-[#7ffc97]/40 text-[#006b2c] text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02] cursor-pointer border border-[#006b2c]/20"
          >
            <span className="material-symbols-outlined text-[15px] text-[#006b2c]">magic_button</span>
            <span>Document our teamwork</span>
          </button>
          <button
            onClick={() => handleSend('Summarize thread decisions')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffffff] hover:bg-[#7ffc97]/30 text-[#131b2e] text-xs font-medium shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-[#006b2c]">summarize</span>
            <span>Summarize thread</span>
          </button>
          <button
            onClick={() => handleSend('Break into test steps')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffffff] hover:bg-[#7ffc97]/30 text-[#131b2e] text-xs font-medium shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-[#006b2c]">alt_route</span>
            <span>Break into test steps</span>
          </button>
          <button
            onClick={() => handleSend('Draft my daily update')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffffff] hover:bg-[#7ffc97]/30 text-[#131b2e] text-xs font-medium shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-[#006b2c]">draw</span>
            <span>Draft my update</span>
          </button>
          <button
            onClick={() => handleSend('What did I miss?')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffffff] hover:bg-[#7ffc97]/30 text-[#131b2e] text-xs font-medium shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-[#006b2c]">history_toggle_off</span>
            <span>What did I miss?</span>
          </button>
        </div>

        {/* 3. Scrollable Message Stream */}
        <div ref={chatStreamRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-[#eaedff]"></div>
            <span className="text-[11px] text-[#6e7b6c] font-medium">Session Started · Redis Incident Analysis</span>
            <div className="flex-1 h-px bg-[#eaedff]"></div>
          </div>

          {messages.map((msg) => (
            <React.Fragment key={msg.id}>
              {msg.sender === 'user' ? (
                /* User Prompt Bubble */
                <div className="flex items-start justify-end gap-2.5 pl-8 animate-in fade-in">
                  <div className="flex flex-col items-end gap-1 max-w-[85%]">
                    <div className="p-3.5 rounded-2xl rounded-tr-xs bg-[#006b2c] text-white text-[13px] leading-relaxed shadow-xs">
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-[#6e7b6c] pr-1">{msg.timestamp}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#7ffc97] flex items-center justify-center text-[10px] text-[#002109] font-bold shrink-0 mt-0.5">
                    AL
                  </div>
                </div>
              ) : (
                /* AI Structured Response */
                <div className="flex items-start gap-2.5 pr-2 animate-in fade-in">
                  <div className="w-7 h-7 rounded-lg bg-[#006b2c] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="p-4 rounded-2xl rounded-tl-xs bg-[#f2f3ff] text-[#131b2e] flex flex-col gap-3 shadow-xs text-[13px]">
                      <p className="leading-relaxed">{msg.text}</p>

                      {msg.isStructured && (
                        <>
                          {/* Consensus Key Decisions Box */}
                          <div className="flex flex-col gap-2 p-3 rounded-[10px] bg-[#ffffff] border border-[#eaedff]">
                            <span className="text-xs font-semibold text-[#131b2e] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-[#006b2c]">task_alt</span>
                              Consensus Key Decisions
                            </span>
                            <ul className="flex flex-col gap-1.5 pl-1.5 text-xs text-[#3e4a3d]">
                              <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] shrink-0 mt-1.5"></span>
                                <span>
                                  <strong>180s Proxy Buffer:</strong> Absorbs NTP drift across active-active clusters.
                                </span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] shrink-0 mt-1.5"></span>
                                <span>
                                  <strong>Atomic Lua Script:</strong> Handles atomic counter sliding without partial write locks.
                                </span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] shrink-0 mt-1.5"></span>
                                <span>
                                  <strong>Threshold Gate:</strong> Dynamic fallback triggers only on packet drops &gt; 1.5%.
                                </span>
                              </li>
                            </ul>
                          </div>

                          {/* Recommended Next Step Box */}
                          <div className="p-3 rounded-[10px] bg-[#7ffc97]/25 text-[#005320] flex flex-col gap-1 text-xs">
                            <span className="font-semibold flex items-center gap-1.5 text-[#006b2c]">
                              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                              Recommended Next Step
                            </span>
                            <p>
                              Deploy test plan targeting cluster failover under synthetic{' '}
                              <strong>250ms latency jitter</strong> with sustained writes.
                            </p>
                          </div>

                          {/* Sources Referenced Shelf */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            <span className="text-[10px] text-[#6e7b6c] uppercase tracking-wider font-semibold">
                              Sources Referenced
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ffffff] text-[#131b2e] text-[11px] shadow-2xs border border-[#eaedff]">
                                <span className="material-symbols-outlined text-[13px] text-[#006b2c]">description</span>
                                <span>architecture-spec.pdf</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ffffff] text-[#131b2e] text-[11px] shadow-2xs border border-[#eaedff]">
                                <span className="material-symbols-outlined text-[13px] text-[#0051d5]">merge</span>
                                <span>PR #412 (Merged)</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ffffff] text-[#131b2e] text-[11px] shadow-2xs border border-[#eaedff]">
                                <span className="material-symbols-outlined text-[13px] text-[#8d4b00]">forum</span>
                                <span>David Kim's Solution</span>
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Standup Block if present */}
                      {msg.text.includes('Ready for Daily Standup') && (
                        <div className="mt-1 flex items-center justify-between pt-2 border-t border-[#eaedff]">
                          <button
                            onClick={() => {
                              if (onPostToStandup) {
                                onPostToStandup({
                                  done: 'Verified consensus with David Kim on atomic Lua scripts to eliminate Redis TTL race conditions during failover.',
                                  doing: 'Configuring synthetic 250ms NTP jitter load test for secondary proxy failover under 50k writes/sec.',
                                  blocked: 'None',
                                });
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">send</span>
                            <span>Post to #standup-core</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Feedback & Insert Row */}
                    <div className="flex items-center justify-between px-1 text-[#6e7b6c] text-xs">
                      <div className="flex items-center gap-1">
                        <button className="p-1 rounded hover:bg-[#eaedff] hover:text-[#131b2e] transition-colors" title="Helpful">
                          <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                        </button>
                        <button className="p-1 rounded hover:bg-[#eaedff] hover:text-[#131b2e] transition-colors" title="Not helpful">
                          <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                        </button>
                        <div className="w-px h-3.5 bg-[#eaedff] mx-1"></div>
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#eaedff] hover:text-[#131b2e] transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedId === msg.id ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedId === msg.id ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => onInsertToTask && onInsertToTask(msg.text)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ffffff] hover:bg-[#eaedff] text-[#131b2e] text-[11px] font-semibold shadow-2xs border border-[#eaedff] cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-[#006b2c]">add_task</span>
                        <span>Insert to Task</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-[#006b2c] font-medium p-3 rounded-xl bg-[#f2f3ff] w-fit animate-pulse">
              <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
              <span>Analyzing workspace context & code references...</span>
            </div>
          )}
        </div>

        {/* 4. Docked Input Surface */}
        <div className="p-4 bg-[#ffffff] shrink-0 border-t border-[#eaedff] flex flex-col gap-2">
          {/* Active Context Capsule */}
          <div className="flex items-center justify-between px-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaedff] text-[#3e4a3d] text-[11px] font-medium truncate max-w-[340px]">
              <span className="material-symbols-outlined text-[14px] text-[#006b2c]">target</span>
              <span className="truncate">
                Active context: <strong>Sprint Architecture & Codebase</strong>
              </span>
            </div>
            <span className="text-[11px] text-[#006b2c] hover:underline cursor-pointer">Live Pod Sync</span>
          </div>

          {/* Input Box */}
          <div className="relative flex flex-col rounded-[14px] bg-[#f2f3ff] p-2 focus-within:bg-[#ffffff] focus-within:ring-2 focus-within:ring-[#006b2c]/20 transition-all border border-[#eaedff]">
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full bg-transparent resize-none text-[13px] text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none p-1.5 leading-relaxed"
              placeholder="Ask AI anything about this page, tasks, or docs..."
              rows={2}
            />

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 text-[#6e7b6c]">
                <button
                  type="button"
                  className="p-1.5 rounded-lg hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                  title="Mention task, member or doc"
                  onClick={() => setInputPrompt((prev) => prev + ' @David Kim ')}
                >
                  <span className="material-symbols-outlined text-[18px]">alternate_email</span>
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-lg hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                  title="Attach file or code snippet"
                  onClick={() => setInputPrompt((prev) => prev + ' [Attached: tokens.config.json] ')}
                >
                  <span className="material-symbols-outlined text-[18px]">attach_file</span>
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-lg hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                  title="Voice prompt"
                  onClick={() => handleSend('Summarize blockers in #backend')}
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSend()}
                className="w-8 h-8 rounded-full bg-[#006b2c] hover:bg-[#00873a] text-white flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer"
                title="Send prompt"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 text-center text-[10px] text-[#6e7b6c] py-0.5">
            <span className="material-symbols-outlined text-[12px] text-[#006b2c]">security</span>
            <span>TeamHub AI uses verified pod repositories & channels</span>
          </div>
        </div>
      </aside>
    </>
  );
};
