import React, { useState } from 'react';
import { User } from '../../types';

interface MobileChannelsScreenProps {
  currentUser: User;
  onOpenThread: () => void;
  onOpenSpecPreview: () => void;
}

export const MobileChannelsScreen: React.FC<MobileChannelsScreenProps> = ({
  currentUser,
  onOpenThread,
  onOpenSpecPreview,
}) => {
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      author: string;
      avatar: string;
      time: string;
      text: string;
      isAi?: boolean;
    }>
  >([]);

  const [inputText, setInputText] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [reactionCounts, setReactionCounts] = useState({ clap: 4, party: 2 });
  const [hasClapped, setHasClapped] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        author: currentUser.name,
        avatar: currentUser.avatarUrl || '',
        time: 'Just now',
        text: inputText.trim(),
      },
    ]);
    setInputText('');
  };

  const copyCssTokens = () => {
    navigator.clipboard.writeText(`:root { --primary-cta: #16a34a; --surface-low: #f2f3ff; }`);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1500);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#faf8ff] pb-28 text-[#131b2e]">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#faf8ff]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#006b2c] flex items-center justify-center text-white shadow-xs shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="7" r="3"></circle>
              <circle cx="6" cy="17" r="3"></circle>
              <circle cx="18" cy="17" r="3"></circle>
              <line x1="8.5" x2="10" y1="15.5" y2="9.5"></line>
              <line x1="15.5" x2="14" y1="15.5" y2="9.5"></line>
              <line x1="9" x2="15" y1="17" y2="17"></line>
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] uppercase tracking-wider text-[#006b2c] font-bold">TeamHub</span>
              <span className="material-symbols-outlined text-[14px] text-[#3e4a3d]">unfold_more</span>
            </div>
            <span className="text-base font-semibold text-[#131b2e] truncate">Channels</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            aria-label="Notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#3e4a3d] hover:text-[#131b2e] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#006b2c] text-white flex items-center justify-center text-xs font-bold shadow-xs">
            {currentUser.initials}
          </div>
        </div>
      </header>

      {/* Sticky Sub-Header: Channel Context & Actions */}
      <section className="sticky top-14 z-30 bg-[#faf8ff]/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between shadow-2xs border-b border-[#eaedff]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#eaedff] flex items-center justify-center text-[#006b2c] shrink-0">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              tag
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-semibold text-[#131b2e] truncate">design</span>
              <span
                className="material-symbols-outlined text-[15px] text-[#006b2c]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                lock_open
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#006b2c] animate-pulse"></span>
              <span className="text-[11px] text-[#3e4a3d] font-medium">8 members active</span>
            </div>
          </div>
        </div>

        {/* Quick Channel Utility Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            aria-label="Search channel"
            className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button
            onClick={onOpenThread}
            aria-label="Active Threads"
            className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] active:scale-95 transition-transform relative cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">forum</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#316bf3]"></span>
          </button>
          <button
            aria-label="Channel Details"
            className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">info</span>
          </button>
        </div>
      </section>

      {/* Feed Topic Banner */}
      <div className="px-4 pt-2.5 pb-1">
        <div className="bg-[#f2f3ff] px-3.5 py-2 rounded-xl flex items-center justify-between border border-[#eaedff]/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[16px] text-[#8d4b00]">push_pin</span>
            <p className="text-xs text-[#3e4a3d] truncate">Sprint 24: Navigation redesign & micro-interactions audit</p>
          </div>
          <span
            onClick={onOpenSpecPreview}
            className="text-[11px] text-[#006b2c] font-semibold shrink-0 ml-2 hover:underline cursor-pointer"
          >
            Docs
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex flex-col px-4 py-2 space-y-4">
        {/* Day Divider */}
        <div className="flex items-center justify-center my-1">
          <div className="bg-[#e2e7ff] px-3 py-0.5 rounded-full shadow-2xs">
            <span className="text-[11px] text-[#3e4a3d] uppercase tracking-wider font-semibold">
              Today, Oct 24
            </span>
          </div>
        </div>

        {/* Message 1: David Kim with wireframe preview */}
        <article className="flex items-start gap-3">
          <div className="relative shrink-0">
            <img
              className="w-10 h-10 rounded-full object-cover shadow-2xs"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYZ7euXrRNOxIAZMnwNG3xFprR7UM70f0Ks8-dT4gYB0ut_CSi32s_BOGd2MaThYfP4DaA3FLzlfHG36jugMJGltbhNQuGdYuqnzpC_ygu8CJ-BODgW2C_j6m6SuKpN7chKKTHfSkDlP8h02dY15iB5LGGOOFhM88VOoDhkStrXmIt2xxLf_xz_JuJ5EHx508-UpzZDI9VOqOl7NU8WbaLaNvzLRr_7ySGYCUNYwQ5araCBk4ZPfnnPg"
              alt="David Kim"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#006b2c] border-2 border-[#faf8ff] flex items-center justify-center"></span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-bold text-[#131b2e]">David Kim</span>
              <span className="text-[11px] text-[#6e7b6c]">10:14 AM</span>
            </div>
            <div className="bg-[#ffffff] p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-2.5 border border-[#eaedff]/60">
              <p className="text-[13px] text-[#131b2e] leading-relaxed">
                Updated the wireframe flow for the new mobile navigation bar. Simplified the icon stack and added comfortable 48px target pads for one-hand operation. Check the card states below!
              </p>

              {/* Interactive Attachment Preview Card */}
              <div className="bg-[#f2f3ff] rounded-xl p-2.5 flex flex-col gap-2 border border-[#eaedff]">
                <div className="relative w-full h-36 rounded-lg overflow-hidden bg-[#eaedff]">
                  <img
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2W1Yh3p-h3fVuRFkXZYFJewMERxDHGQoWHDB0KC-iZ-sF9CRvaYvEd9IQ-J_a77uA-GxNWu2jNHJf5f5dwl9Q56exTHR2VLO0WNkvoKMDmnr9vgTkb_ZVergJ7eqdSjkscJ8WDQmR6NZV0GhuqWNF4mW5aPd0R8SjD-Huxlr4I-ZoUrC9WZRJ2DIKSxSTR-m9vPZ1BDUzS_lP4epS3IY3P2dfAYkuhU3rJvI216_MLjHlG2ZVXZENzw"
                    alt="Wireframe preview"
                  />
                  <div className="absolute top-2 right-2 bg-[#283044]/80 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="material-symbols-outlined text-[#eef0ff] text-[13px]">view_in_ar</span>
                    <span className="text-[10px] text-[#eef0ff] font-semibold">Figma Spec</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#006b2c]/10 flex items-center justify-center text-[#006b2c] shrink-0">
                      <span className="material-symbols-outlined text-[16px]">design_services</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[#131b2e] font-semibold truncate">nav-v3-hand-audit.fig</p>
                      <p className="text-[10px] text-[#6e7b6c]">4.2 MB • Interactive Wireframes</p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenSpecPreview}
                    aria-label="Open attachment preview"
                    className="w-8 h-8 rounded-lg bg-[#dae2fd] flex items-center justify-center text-[#006b2c] active:scale-95 transition-transform shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                  </button>
                </div>
              </div>

              {/* Micro Reactions */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => {
                    setReactionCounts((p) => ({ ...p, clap: p.clap + (hasClapped ? -1 : 1) }));
                    setHasClapped(!hasClapped);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                    hasClapped ? 'bg-[#7ffc97] text-[#002109]' : 'bg-[#e2e7ff] text-[#131b2e]'
                  }`}
                >
                  <span>👏</span>
                  <span>{reactionCounts.clap}</span>
                </button>
                <button
                  onClick={() => setReactionCounts((p) => ({ ...p, party: p.party + 1 }))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e2e7ff] text-[#131b2e] text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                >
                  <span>🎉</span>
                  <span>{reactionCounts.party}</span>
                </button>
                <button
                  aria-label="Add reaction"
                  className="w-6 h-6 rounded-full bg-[#eaedff] flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">add_reaction</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* Message 2: Sarah Connor */}
        <article className="flex items-start gap-3">
          <div className="relative shrink-0">
            <img
              className="w-10 h-10 rounded-full object-cover shadow-2xs"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0atzQ5EbNkitDENTQN8ef_hBFtu6vp3GlkO2ZX_LFYjZYEiOp8eIgkCKdFRXTMN4RbAbYbvPblFxHM6QAXM6HrRTxBysZW-oJSthDB2dEjyGuVyOhdNMRpRR1a4Oq7X2xB1ulj_1_zzToYfXs0W55ZKtDp2-1Z1_LDomC8O0NzFPfAyY9lqedqRwcn2pBxFB2HJafX4Xl18Y5hNuX7wp7efLdXlWfQCkYvXaYRYQ6-p5HZE_ylBIa1Q"
              alt="Sarah Connor"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#006b2c] border-2 border-[#faf8ff] flex items-center justify-center"></span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-bold text-[#131b2e]">Sarah Connor</span>
              <span className="text-[11px] text-[#6e7b6c]">10:28 AM</span>
            </div>
            <div className="bg-[#ffffff] p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-2.5 border border-[#eaedff]/60">
              <p className="text-[13px] text-[#131b2e] leading-relaxed">
                Looks super clean David! One question on the token mapping: are we sticking with{' '}
                <code className="bg-[#e2e7ff] text-[#006b2c] px-1.5 py-0.5 rounded font-mono text-[11px] font-bold">
                  #16a34a
                </code>{' '}
                for primary tap states, or using the muted surface tint?
              </p>

              {/* Interactive Reply Count Pill Button */}
              <div className="pt-1">
                <button
                  onClick={onOpenThread}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#eaedff] hover:bg-[#e2e7ff] active:scale-[0.99] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#00873a] flex items-center justify-center text-[9px] text-white font-bold">
                        DK
                      </div>
                      <div className="w-5 h-5 rounded-full bg-[#316bf3] flex items-center justify-center text-[9px] text-white font-bold">
                        AI
                      </div>
                    </div>
                    <span className="text-xs text-[#006b2c] font-semibold">3 replies</span>
                    <span className="text-[10px] text-[#6e7b6c]">• Last reply 2m ago</span>
                  </div>
                  <span className="material-symbols-outlined text-[#006b2c] text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* Message 3: TeamHub AI Assistant */}
        <article className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#006b2c] flex items-center justify-center text-white shrink-0 shadow-xs">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1 bg-[#dae2fd] px-2 py-0.5 rounded-full">
                <span className="text-[11px] text-[#006b2c] font-bold tracking-tight">TeamHub AI</span>
              </div>
              <span className="text-[11px] text-[#6e7b6c]">10:29 AM</span>
            </div>
            <div className="bg-[#ffffff] p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-3 border border-[#eaedff]/60">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5">
                  Token Audit & Recommendation
                </h4>
                <span className="text-[10px] text-[#006b2c] bg-[#006b2c]/10 px-2 py-0.5 rounded-full font-bold">
                  Verified System
                </span>
              </div>
              <p className="text-xs text-[#3e4a3d] leading-relaxed">
                Per the <strong className="text-[#131b2e] font-semibold">Calm Collaborative System</strong> guide, active icon/button tap states use the explicit primary token:
              </p>

              {/* Concise Token Visual Summary Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f2f3ff]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-[#16a34a] shrink-0 shadow-xs"></span>
                    <div>
                      <span className="text-xs font-bold text-[#131b2e]">Primary CTA / Active</span>
                      <p className="text-[10px] text-[#6e7b6c]">Used for send actions, key highlights</p>
                    </div>
                  </div>
                  <code className="font-mono text-xs font-semibold text-[#006b2c] px-2 py-0.5 rounded bg-[#eaedff]">
                    #16a34a
                  </code>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f2f3ff]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-[#f2f3ff] border border-[#bdcaba] shrink-0"></span>
                    <div>
                      <span className="text-xs font-bold text-[#131b2e]">Surface Low</span>
                      <p className="text-[10px] text-[#6e7b6c]">Muted message container backing</p>
                    </div>
                  </div>
                  <code className="font-mono text-xs font-semibold text-[#3e4a3d] px-2 py-0.5 rounded bg-[#eaedff]">
                    #f2f3ff
                  </code>
                </div>
              </div>

              {/* AI Action Suggestion Pills */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  onClick={copyCssTokens}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eaedff] text-[#131b2e] text-xs font-medium hover:bg-[#e2e7ff] transition-colors active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px] text-[#006b2c]">
                    {copiedToken ? 'check' : 'copy_all'}
                  </span>
                  <span>{copiedToken ? 'Copied!' : 'Copy CSS Tokens'}</span>
                </button>
                <button
                  onClick={onOpenSpecPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eaedff] text-[#131b2e] text-xs font-medium hover:bg-[#e2e7ff] transition-colors active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px] text-[#0051d5]">open_in_new</span>
                  <span>Open Color Spec</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* User Injected Messages */}
        {messages.map((m) => (
          <article key={m.id} className="flex items-start gap-3 justify-end animate-in fade-in">
            <div className="flex flex-col items-end max-w-[80%]">
              <span className="text-[10px] text-[#6e7b6c] mb-0.5">{m.time}</span>
              <div className="bg-[#006b2c] text-white p-3 rounded-2xl rounded-tr-xs shadow-xs text-xs leading-relaxed">
                {m.text}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Pinned Floating Composer */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 bg-gradient-to-t from-[#faf8ff] via-[#faf8ff]/95 to-transparent pt-3 pointer-events-none">
        <form
          onSubmit={handleSendMessage}
          className="pointer-events-auto flex items-end gap-2 bg-[#ffffff] p-1.5 rounded-2xl shadow-lg border border-[#eaedff]"
        >
          {/* Action buttons */}
          <div className="flex items-center gap-0.5 pb-0.5">
            <button
              type="button"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] active:scale-95 transition-all cursor-pointer"
              title="Add attachment"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
            </button>
            <button
              type="button"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] active:scale-95 transition-all cursor-pointer"
              title="Mention teammate"
            >
              <span className="material-symbols-outlined text-[20px]">alternate_email</span>
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 min-w-0 py-1.5 px-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message #design..."
              className="w-full bg-transparent text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none leading-5"
            />
          </div>

          {/* Send */}
          <div className="flex items-center gap-1 pb-0.5 shrink-0">
            <button
              type="button"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] active:scale-95 transition-all cursor-pointer"
              title="Voice memo"
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
            <button
              type="submit"
              className="w-9 h-9 rounded-xl bg-[#006b2c] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              title="Send message"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                send
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
