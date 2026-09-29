import React, { useState, useRef, useEffect } from 'react';
import { User, Channel, ChannelMessage } from '../../types';
import { CHANNELS, INITIAL_CHANNEL_MESSAGES, USERS } from '../../data/mockData';
import { TeammateProfilePopover } from '../common/TeammateProfilePopover';
import { getLocalChannels } from '../../lib/supabase';

interface ChannelsViewProps {
  currentUser: User;
  onOpenAiDrawer: () => void;
  onViewTasksForUser: (user: User) => void;
  onOpenSpecDoc: () => void;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({
  currentUser,
  onOpenAiDrawer,
  onViewTasksForUser,
  onOpenSpecDoc,
}) => {
  const [channels, setChannels] = useState<Channel[]>(getLocalChannels());
  const [activeChannelId, setActiveChannelId] = useState('design');
  const [messages, setMessages] = useState<ChannelMessage[]>(INITIAL_CHANNEL_MESSAGES);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [popoverUser, setPopoverUser] = useState<User>(USERS.david);
  const [inputMessage, setInputMessage] = useState('');
  const [threadInput, setThreadInput] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const input = inputRef.current;
    if (!input) {
      setInputMessage((prev) => prev + `${prefix}text${suffix}`);
      return;
    }

    const start = input.selectionStart ?? inputMessage.length;
    const end = input.selectionEnd ?? inputMessage.length;
    const selectedText = inputMessage.substring(start, end);

    const replacement = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}text${suffix}`;
    const newText = inputMessage.substring(0, start) + replacement + inputMessage.substring(end);
    setInputMessage(newText);

    setTimeout(() => {
      input.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = selectedText ? cursorStart + selectedText.length : cursorStart + 4;
      input.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  };

  // Thread replies state
  const [threadReplies, setThreadReplies] = useState([
    {
      id: 'tr-1',
      author: USERS.ai,
      createdAt: '10:16 AM',
      isAi: true,
      content: 'I ran an automated contrast check for #surface-dim against #1e293b — ratio is 5.8:1, passing AA standards.',
    },
    {
      id: 'tr-2',
      author: USERS.marcus,
      createdAt: '10:20 AM',
      content: 'Looks great on the Figma mocks too! We verified with Sarah earlier.',
    },
    {
      id: 'tr-3',
      author: USERS.david,
      createdAt: '10:25 AM',
      content: 'Confirmed on device testbed. Low-brightness OLED clipping is negligible.',
    },
  ]);

  const activeChannel = channels.find((c) => c.id === activeChannelId || c.name === activeChannelId) || channels[2] || channels[0];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChannelMessage = {
      id: `msg-${Date.now()}`,
      author: currentUser,
      createdAt: 'Just now',
      content: inputMessage.trim(),
      reactions: [],
      threadRepliesCount: 0,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
    setShowEmptyState(false);
  };

  const handleSendThreadReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInput.trim()) return;

    setThreadReplies((prev) => [
      ...prev,
      {
        id: `tr-${Date.now()}`,
        author: currentUser,
        createdAt: 'Just now',
        content: threadInput.trim(),
      },
    ]);
    setThreadInput('');
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const existing = msg.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            const userReacted = !existing.userReacted;
            const count = existing.count + (userReacted ? 1 : -1);
            return {
              ...msg,
              reactions: msg.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count, userReacted } : r
              ),
            };
          } else {
            return {
              ...msg,
              reactions: [...msg.reactions, { emoji, count: 1, userReacted: true }],
            };
          }
        }
        return msg;
      })
    );
  };

  return (
    <div className="flex w-full h-[calc(100vh-5rem)] -m-8 overflow-hidden bg-[#faf8ff] relative">
      {/* 1. SECONDARY CHANNEL NAVIGATOR SIDEBAR */}
      <aside className="w-64 flex-shrink-0 bg-[#f2f3ff] flex flex-col justify-between select-none border-r border-[#eaedff] z-20">
        <div className="flex flex-col flex-1 overflow-y-auto p-3">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-2 mb-1">
            <div className="flex items-center gap-1.5 text-[#3e4a3d]">
              <span className="material-symbols-outlined text-[18px]">folder_special</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">Channels</span>
            </div>
            <button
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="p-1 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
              title="Toggle Empty Channel Demo"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showEmptyState ? 'visibility' : 'visibility_off'}
              </span>
            </button>
          </div>

          {/* Channel list */}
          <nav className="flex flex-col gap-0.5">
            {channels.map((ch) => {
              const isActive = ch.id === activeChannelId;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChannelId(ch.id);
                    if (ch.id === 'general') setShowEmptyState(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#eaedff] text-[#006b2c] font-bold shadow-2xs'
                      : 'text-[#3e4a3d] hover:bg-[#eaedff]/60 hover:text-[#131b2e]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">
                      {ch.icon || 'tag'}
                    </span>
                    <span className="truncate">{ch.name}</span>
                  </div>
                  {ch.unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#006b2c] text-white font-bold">
                      {ch.unreadCount}
                    </span>
                  )}
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>}
                </button>
              );
            })}
          </nav>

          {/* Direct messages */}
          <div className="flex items-center justify-between px-2 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6e7b6c]">
            <span>Direct Messages</span>
            <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-[#131b2e]">add</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              onClick={onOpenAiDrawer}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#7ffc97] text-[#002109] font-bold text-[10px] flex items-center justify-center">
                  AI
                </div>
                <span className="font-semibold text-[#131b2e]">TeamHub AI</span>
              </div>
              <span className="text-[10px] bg-[#7ffc97]/50 text-[#005320] px-1.5 py-0.2 rounded font-bold">
                AI
              </span>
            </button>

            <button
              onClick={() => {
                setPopoverUser(USERS.david);
                setShowProfilePopover(true);
              }}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-[10px] flex items-center justify-center">
                  DK
                </div>
                <span>David Kim</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>
            </button>

            <button
              onClick={() => {
                setPopoverUser(USERS.anya);
                setShowProfilePopover(true);
              }}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#ffdcc3] text-[#2f1500] font-bold text-[10px] flex items-center justify-center">
                  AL
                </div>
                <span>Anya Lin</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#bdcaba]"></span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#eaedff]/60 border-t border-[#eaedff] flex items-center justify-between text-xs text-[#3e4a3d]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#006b2c] animate-pulse"></span>
            <span className="text-[11px] font-medium">Design Pod • 8 Active</span>
          </div>
          <button
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="text-[10px] font-semibold text-[#006b2c] hover:underline cursor-pointer"
          >
            {showEmptyState ? 'Show Stream' : 'Empty Demo'}
          </button>
        </div>
      </aside>

      {/* 2. MAIN CHANNEL STAGE */}
      <section className="flex-1 flex flex-col bg-[#ffffff] overflow-hidden relative min-w-0">
        {/* Channel Top Header Bar */}
        <div className="h-16 px-6 border-b border-[#eaedff] flex items-center justify-between bg-[#ffffff] z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#f2f3ff] flex items-center justify-center text-[#006b2c]">
              <span className="material-symbols-outlined text-[20px]">tag</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#131b2e]">{activeChannel.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[11px] text-[#3e4a3d] font-semibold">
                  Core Pod
                </span>
              </div>
              <p className="text-xs text-[#6e7b6c] truncate">
                {activeChannel.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center -space-x-1.5 mr-2">
              <div className="w-7 h-7 rounded-full bg-[#f2f3ff] text-[#131b2e] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                SC
              </div>
              <div className="w-7 h-7 rounded-full bg-[#7ffc97] text-[#002109] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                DK
              </div>
              <div className="w-7 h-7 rounded-full bg-[#ffdcc3] text-[#2f1500] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                ML
              </div>
              <div className="w-7 h-7 rounded-full bg-[#eaedff] text-[#3e4a3d] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                +8
              </div>
            </div>

            <button
              onClick={() => setShowThreadPanel(!showThreadPanel)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">forum</span>
              <span>Threads ({threadReplies.length})</span>
            </button>

            <button
              onClick={onOpenSpecDoc}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">push_pin</span>
              <span>Pinned (4)</span>
            </button>
          </div>
        </div>

        {/* Pinned Topic Banner */}
        <div className="px-6 py-2 bg-[#f2f3ff] border-b border-[#eaedff] flex items-center justify-between text-xs text-[#131b2e] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[16px] text-[#8d4b00]">push_pin</span>
            <span className="font-semibold truncate">
              Sprint 42 Design Specs & Figma Token Guidelines v2.4
            </span>
            <span className="text-[#6e7b6c] hidden md:inline">• Sarah Connor • Oct 24</span>
          </div>
          <button
            onClick={onOpenSpecDoc}
            className="text-[#006b2c] font-semibold hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>View Doc</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </button>
        </div>

        {/* EMPTY STATE DEMO (Screen 4) */}
        {showEmptyState ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="absolute w-72 h-72 rounded-full bg-[#7ffc97]/25 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col items-center max-w-md">
              <div className="w-32 h-32 rounded-full bg-[#f2f3ff] flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-16 h-16 text-[#006b2c]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#131b2e] mb-1.5">Welcome to #{activeChannel.name}</h2>
              <p className="text-xs text-[#6e7b6c] mb-6 leading-relaxed">
                This is the start of the #{activeChannel.name} channel for project discussions, wireframes, and design critique.
              </p>
              <button
                onClick={() => setShowEmptyState(false)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                <span>Send first message</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE CONVERSATION STREAM */
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {/* Day Divider */}
            <div className="flex items-center justify-center gap-4 my-1">
              <div className="h-px bg-[#eaedff] flex-1"></div>
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] px-3 py-1 rounded-full bg-[#f2f3ff] font-semibold">
                Today, October 24
              </span>
              <div className="h-px bg-[#eaedff] flex-1"></div>
            </div>

            {/* Message 1: Sarah Connor */}
            <div className="flex items-start gap-3.5 group rounded-xl p-2.5 -mx-2 hover:bg-[#faf8ff] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs shrink-0 flex items-center justify-center">
                SC
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#131b2e]">Sarah Connor</span>
                  <span className="text-[10px] text-[#6e7b6c]">10:14 AM</span>
                  <span className="px-2 py-0.2 rounded-full bg-[#eaedff] text-[10px] text-[#3e4a3d]">
                    Product
                  </span>
                </div>
                <p className="text-[13px] text-[#131b2e] leading-relaxed">
                  Hey team, quick update on the Q4 workspace rollout. We verified the typography scales across the desktop breakpoint.{' '}
                  <button
                    onClick={() => {
                      setPopoverUser(USERS.david);
                      setShowProfilePopover(true);
                    }}
                    className="text-[#006b2c] font-semibold hover:underline cursor-pointer"
                  >
                    @David Kim
                  </button>{' '}
                  can you confirm if the dynamic token updates in the CSS pipeline are live on canary?
                </p>
              </div>
            </div>

            {/* Message 2: David Kim (Interactive trigger row where popover originates) */}
            <div className="relative flex items-start gap-3.5 rounded-2xl p-4 -mx-2 bg-[#ffffff] shadow-xs border border-[#eaedff]">
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    setPopoverUser(USERS.david);
                    setShowProfilePopover(!showProfilePopover);
                  }}
                  className="w-10 h-10 rounded-full bg-[#7ffc97] flex items-center justify-center text-xs font-bold text-[#002109] ring-2 ring-[#006b2c] cursor-pointer"
                >
                  DK
                </button>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00873a] ring-2 ring-white"></span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => {
                      setPopoverUser(USERS.david);
                      setShowProfilePopover(!showProfilePopover);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#eaedff] text-xs font-bold text-[#006b2c] hover:bg-[#dbe1ff] transition-all cursor-pointer"
                  >
                    <span>David Kim</span>
                    <span
                      className="material-symbols-outlined text-[15px] text-[#006b2c]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                  </button>
                  <span className="text-[10px] text-[#6e7b6c]">10:28 AM</span>
                  <span className="px-2 py-0.2 rounded-full bg-[#eaedff] text-[10px] text-[#006b2c] font-semibold">
                    Lead
                  </span>
                </div>

                <p className="text-[13px] text-[#131b2e] leading-relaxed">
                  Yes! Canary build v2.14.0 contains all fixed tokens including surface contrast mappings and reduced motion queries. Tokens build seamlessly on top of the layout engine without regressions.
                </p>

                {/* Code Snippet Attachment */}
                <div className="mt-3 p-3 rounded-xl bg-[#f2f3ff] font-mono text-[12px] text-[#3e4a3d] flex items-center justify-between border border-[#eaedff]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#006b2c]">data_object</span>
                    <span>tokens.config.json • SHA 4fd802e</span>
                  </div>
                  <span className="text-[11px] text-[#006b2c] font-bold">100% Synced</span>
                </div>

                {/* Reactions & Thread Trigger */}
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => toggleReaction('msg-2', '👍')}
                    className="flex items-center gap-1 text-xs text-[#3e4a3d] hover:text-[#131b2e] cursor-pointer"
                  >
                    <span>👍</span>
                    <span className="font-semibold">4</span>
                  </button>
                  <button
                    onClick={() => toggleReaction('msg-2', '🚀')}
                    className="flex items-center gap-1 text-xs text-[#3e4a3d] hover:text-[#131b2e] cursor-pointer"
                  >
                    <span>🚀</span>
                    <span className="font-semibold">2</span>
                  </button>
                  <button
                    onClick={() => setShowThreadPanel(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-[#006b2c] hover:underline cursor-pointer ml-2"
                  >
                    <span className="material-symbols-outlined text-[15px]">reply</span>
                    <span>Reply in thread ({threadReplies.length})</span>
                  </button>
                </div>
              </div>

              {/* FLOATING TEAMMATE PROFILE CARD POPOVER */}
              {showProfilePopover && (
                <TeammateProfilePopover
                  user={popoverUser}
                  onClose={() => setShowProfilePopover(false)}
                  onDirectMessage={() => {
                    setShowProfilePopover(false);
                    setInputMessage(`@${popoverUser.name} `);
                  }}
                  onViewTasks={() => {
                    setShowProfilePopover(false);
                    onViewTasksForUser(popoverUser);
                  }}
                />
              )}
            </div>

            {/* Message 3: TeamHub AI Copilot */}
            <div className="flex items-start gap-3.5 group rounded-xl p-2.5 -mx-2 hover:bg-[#faf8ff] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#7ffc97] text-[#006b2c] shrink-0 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#006b2c]">TeamHub AI</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-[#7ffc97] text-[#005320] text-[10px] font-bold">
                    Automated
                  </span>
                  <span className="text-[10px] text-[#6e7b6c]">10:31 AM</span>
                </div>
                <p className="text-[13px] text-[#131b2e] leading-relaxed">
                  Design audit complete: 0 token discrepancies found across 14 layout primitives. Next automated regression run scheduled for 18:00 UTC.
                </p>
              </div>
            </div>

            {/* Injected New Messages */}
            {messages.slice(3).map((msg) => (
              <div key={msg.id} className="flex items-start gap-3.5 rounded-xl p-2.5 -mx-2 animate-in fade-in">
                <div className="w-9 h-9 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs shrink-0 flex items-center justify-center">
                  {msg.author.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#131b2e]">{msg.author.name}</span>
                    <span className="text-[10px] text-[#6e7b6c]">{msg.createdAt}</span>
                  </div>
                  <p className="text-[13px] text-[#131b2e] leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Chat Input Bar */}
        <div className="sticky bottom-0 p-4 bg-[#ffffff] border-t border-[#eaedff] z-10 shrink-0">
          <form
            onSubmit={handleSendMessage}
            className="rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-sm flex flex-col focus-within:ring-2 focus-within:ring-[#006b2c]/20"
          >
            {/* Formatting Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#f2f3ff]/70 border-b border-[#eaedff]/60 rounded-t-2xl text-[#6e7b6c] text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyFormatting('**')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Bold (**text**)"
                >
                  <span className="material-symbols-outlined text-[16px]">format_bold</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('*')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Italic (*text*)"
                >
                  <span className="material-symbols-outlined text-[16px]">format_italic</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('`')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Code snippet (`code`)"
                >
                  <span className="material-symbols-outlined text-[16px]">code</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('[', '](https://)')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Insert link ([label](url))"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                </button>
                <div className="w-px h-3 bg-[#eaedff] mx-1"></div>
                <button
                  type="button"
                  onClick={() => applyFormatting('\n- ', '')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Bullet list (- item)"
                >
                  <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                </button>
              </div>
              <span className="text-[10px] text-[#6e7b6c]">Markdown supported</span>
            </div>

            {/* Input Row */}
            <div className="p-2.5 flex items-center gap-3">
              <button
                type="button"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                title="Attach file"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message #design or mention @David Kim..."
                className="flex-1 bg-transparent text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none"
              />

              <div className="flex items-center gap-1 text-[#6e7b6c]">
                <button
                  type="button"
                  onClick={() => setInputMessage((p) => p + ' 👍 ')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[19px]">sentiment_satisfied</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMessage((p) => p + ' @David Kim ')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[19px]">alternate_email</span>
                </button>
                <button
                  type="submit"
                  className="w-8 h-8 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* 3. SIDE-BY-SIDE THREAD PANEL (Screen 15) */}
      {showThreadPanel && (
        <aside className="w-[390px] shrink-0 bg-[#ffffff] border-l border-[#eaedff] flex flex-col h-full z-20 shadow-lg animate-in slide-in-from-right duration-200">
          <div className="h-16 px-4 border-b border-[#eaedff] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#131b2e]">Thread</span>
              <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[11px] font-semibold text-[#006b2c]">
                #design
              </span>
            </div>
            <button
              onClick={() => setShowThreadPanel(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Original Message Card */}
            <div className="p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-xs flex items-center justify-center">
                    ER
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#131b2e]">Elena Rostova</span>
                    <span className="text-[10px] text-[#6e7b6c] ml-1.5">10:14 AM</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">push_pin</span>
              </div>
              <p className="text-xs text-[#131b2e] leading-relaxed">
                Hey team! I'm reviewing the contrast on the new dark mode token set for OLED displays. Has anyone checked if the{' '}
                <code className="px-1 py-0.5 rounded bg-[#eaedff] text-[#006b2c] font-mono text-[11px]">
                  #surface-dim
                </code>{' '}
                complies with WCAG AA on low brightness?
              </p>
            </div>

            {/* Replies Divider */}
            <div className="flex items-center justify-center my-2">
              <span className="text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider px-3 py-0.5 rounded-full bg-[#f2f3ff]">
                {threadReplies.length} replies
              </span>
            </div>

            {/* Thread Replies List */}
            <div className="space-y-3">
              {threadReplies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#f2f3ff] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {reply.author.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-[#131b2e]">{reply.author.name}</span>
                      <span className="text-[10px] text-[#6e7b6c]">{reply.createdAt}</span>
                    </div>
                    <p className="text-xs text-[#131b2e] mt-0.5 leading-relaxed">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thread Composer */}
          <div className="p-3 border-t border-[#eaedff] bg-[#ffffff] shrink-0">
            <form onSubmit={handleSendThreadReply} className="flex flex-col gap-2">
              <textarea
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                placeholder="Reply in thread..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006b2c] border border-[#eaedff] resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[#6e7b6c]">
                  <button type="button" className="p-1 rounded hover:bg-[#f2f3ff] text-[16px]">
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  </button>
                  <button type="button" className="p-1 rounded hover:bg-[#f2f3ff] text-[16px]">
                    <span className="material-symbols-outlined text-[16px]">sentiment_satisfied</span>
                  </button>
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  Reply
                </button>
              </div>
            </form>
          </div>
        </aside>
      )}
    </div>
  );
};
