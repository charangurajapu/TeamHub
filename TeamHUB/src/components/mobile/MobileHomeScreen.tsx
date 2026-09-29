import React, { useState } from 'react';
import { User } from '../../types';

interface MobileHomeScreenProps {
  currentUser: User;
  onOpenAssistant: () => void;
  onNavigateToTasks: () => void;
  onNavigateToChannel: (channelId: string) => void;
  onNavigateToQuestions: () => void;
  onLogout?: () => void;
}

export const MobileHomeScreen: React.FC<MobileHomeScreenProps> = ({
  currentUser,
  onOpenAssistant,
  onNavigateToTasks,
  onNavigateToChannel,
  onNavigateToQuestions,
  onLogout,
}) => {
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({
    'task-1': false,
    'task-2': false,
    'task-3': false,
  });

  const toggleTask = (id: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#faf8ff] pb-24 text-[#131b2e]">
      {/* Mobile Sticky Top Header */}
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
            <span className="text-base font-semibold text-[#131b2e] truncate">Home</span>
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            aria-label="Notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#3e4a3d] hover:text-[#131b2e] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <button
            onClick={() => setShowMobileProfileMenu(!showMobileProfileMenu)}
            className="w-8 h-8 rounded-full bg-[#006b2c] text-white flex items-center justify-center text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          >
            {currentUser.initials}
          </button>

          {showMobileProfileMenu && (
            <div className="absolute top-11 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-[#eaedff] p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#eaedff]">
                <div className="w-8 h-8 rounded-full bg-[#7ffc97] text-[#002109] font-bold text-xs flex items-center justify-center">
                  {currentUser.initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#131b2e] truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-[#6e7b6c] truncate">{currentUser.email}</span>
                </div>
              </div>
              <div className="py-2 text-[11px] text-[#3e4a3d] flex items-center justify-between">
                <span>Role:</span>
                <span className="font-semibold capitalize text-[#006b2c]">{currentUser.role}</span>
              </div>
              {onLogout && (
                <button
                  onClick={() => {
                    setShowMobileProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Sign out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex flex-col w-full px-4 pt-3 space-y-4">
        {/* User Greeting Section */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full overflow-hidden shadow-xs bg-[#eaedff]">
                {currentUser.avatarUrl ? (
                  <img
                    className="w-full h-full object-cover"
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-[#006b2c]">
                    {currentUser.initials}
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00873a] ring-2 ring-[#faf8ff]"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[#3e4a3d] font-medium">Tuesday, Oct 24</span>
              <h1 className="text-lg font-semibold text-[#131b2e] tracking-tight">Good morning, Ravi</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="Search items"
              className="w-9 h-9 rounded-full bg-[#f2f3ff] text-[#3e4a3d] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px]">search</span>
            </button>
            <button
              aria-label="Inbox updates"
              className="relative w-9 h-9 rounded-full bg-[#f2f3ff] text-[#3e4a3d] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Card 1: Tasks */}
          <div
            onClick={onNavigateToTasks}
            className="bg-[#ffffff] rounded-xl p-3 shadow-xs flex flex-col justify-between active:scale-[0.98] transition-transform cursor-pointer border border-[#eaedff]/60"
          >
            <div className="flex items-center justify-between">
              <span
                className="material-symbols-outlined text-[18px] text-[#006b2c]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                assignment_turned_in
              </span>
              <span className="text-[11px] text-[#006b2c] font-semibold bg-[#f2f3ff] px-1.5 py-0.5 rounded-full">
                Today
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[#131b2e] block leading-none">3</span>
              <span className="text-xs text-[#3e4a3d] truncate block mt-1">Tasks due</span>
            </div>
          </div>

          {/* Card 2: Unread msgs */}
          <div
            onClick={() => onNavigateToChannel('design')}
            className="bg-[#ffffff] rounded-xl p-3 shadow-xs flex flex-col justify-between active:scale-[0.98] transition-transform cursor-pointer border border-[#eaedff]/60"
          >
            <div className="flex items-center justify-between">
              <span
                className="material-symbols-outlined text-[18px] text-[#0051d5]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                chat_bubble
              </span>
              <span className="text-[11px] text-[#0051d5] font-semibold bg-[#f2f3ff] px-1.5 py-0.5 rounded-full">
                New
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[#131b2e] block leading-none">12</span>
              <span className="text-xs text-[#3e4a3d] truncate block mt-1">Unread msgs</span>
            </div>
          </div>

          {/* Card 3: Q&A */}
          <div
            onClick={onNavigateToQuestions}
            className="bg-[#ffffff] rounded-xl p-3 shadow-xs flex flex-col justify-between active:scale-[0.98] transition-transform cursor-pointer border border-[#eaedff]/60"
          >
            <div className="flex items-center justify-between">
              <span
                className="material-symbols-outlined text-[18px] text-[#b15f00]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                help
              </span>
              <span className="text-[11px] text-[#b15f00] font-semibold bg-[#f2f3ff] px-1.5 py-0.5 rounded-full">
                Waiting
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[#131b2e] block leading-none">2</span>
              <span className="text-xs text-[#3e4a3d] truncate block mt-1">Q&A asks</span>
            </div>
          </div>
        </div>

        {/* Section: My Top Priorities */}
        <section className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00873a]"></span>
              <h2 className="text-base font-semibold text-[#131b2e]">My Top Priorities</h2>
            </div>
            <button
              onClick={onNavigateToTasks}
              className="text-xs text-[#006b2c] font-semibold hover:opacity-80 cursor-pointer"
            >
              View all (7)
            </button>
          </div>

          <div className="space-y-2">
            {/* Task 1 */}
            <div
              onClick={() => toggleTask('task-1')}
              className="bg-[#ffffff] p-3.5 rounded-xl shadow-xs flex items-start gap-3 transition-all border border-[#eaedff]/60 cursor-pointer active:scale-[0.99]"
            >
              <button
                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  completedTasks['task-1'] ? 'bg-[#006b2c] text-white' : 'bg-[#f2f3ff] text-[#3e4a3d]'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[15px] ${
                    completedTasks['task-1'] ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  check
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold truncate text-[#131b2e] ${
                      completedTasks['task-1'] ? 'line-through opacity-50' : ''
                    }`}
                  >
                    Finalize Q4 System Architecture RFC
                  </span>
                  <span className="text-[11px] text-[#ba1a1a] font-medium px-2 py-0.5 rounded-full bg-[#ffdad6]/40 shrink-0">
                    11:00 AM
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-[#3e4a3d]">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">folder</span> Core Pod
                  </span>
                  <span className="text-[#bdcaba]">•</span>
                  <span className="text-[#006b2c] font-medium flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[13px]">mode_comment</span> 4 replies
                  </span>
                </div>
              </div>
            </div>

            {/* Task 2 */}
            <div
              onClick={() => toggleTask('task-2')}
              className="bg-[#ffffff] p-3.5 rounded-xl shadow-xs flex items-start gap-3 transition-all border border-[#eaedff]/60 cursor-pointer active:scale-[0.99]"
            >
              <button
                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  completedTasks['task-2'] ? 'bg-[#006b2c] text-white' : 'bg-[#f2f3ff] text-[#3e4a3d]'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[15px] ${
                    completedTasks['task-2'] ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  check
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold truncate text-[#131b2e] ${
                      completedTasks['task-2'] ? 'line-through opacity-50' : ''
                    }`}
                  >
                    Sign off Mobile Onboarding Figma
                  </span>
                  <span className="text-[11px] text-[#3e4a3d] font-medium px-2 py-0.5 rounded-full bg-[#eaedff] shrink-0">
                    2:30 PM
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-[#3e4a3d]">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">palette</span> Design System
                  </span>
                  <span className="text-[#bdcaba]">•</span>
                  <span>Review required</span>
                </div>
              </div>
            </div>

            {/* Task 3 */}
            <div
              onClick={() => toggleTask('task-3')}
              className="bg-[#ffffff] p-3.5 rounded-xl shadow-xs flex items-start gap-3 transition-all border border-[#eaedff]/60 cursor-pointer active:scale-[0.99]"
            >
              <button
                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  completedTasks['task-3'] ? 'bg-[#006b2c] text-white' : 'bg-[#f2f3ff] text-[#3e4a3d]'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[15px] ${
                    completedTasks['task-3'] ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  check
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold truncate text-[#131b2e] ${
                      completedTasks['task-3'] ? 'line-through opacity-50' : ''
                    }`}
                  >
                    Approve CI/CD release build v2.1.0
                  </span>
                  <span className="text-[11px] text-[#3e4a3d] font-medium px-2 py-0.5 rounded-full bg-[#eaedff] shrink-0">
                    5:00 PM
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-[#3e4a3d]">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">rocket_launch</span> Infra
                  </span>
                  <span className="text-[#bdcaba]">•</span>
                  <span className="text-[#006b2c] font-medium">Ready</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: What's Happening Now */}
        <section className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#316bf3]"></span>
              <h2 className="text-base font-semibold text-[#131b2e]">What's happening now</h2>
            </div>
            <span className="text-[11px] text-[#3e4a3d]">Live updates</span>
          </div>

          <div className="bg-[#ffffff] rounded-xl p-4 shadow-xs space-y-3.5 border border-[#eaedff]/60">
            {/* Live item 1 */}
            <div
              onClick={() => onNavigateToChannel('design')}
              className="flex items-start gap-3 cursor-pointer"
            >
              <div className="relative shrink-0 mt-0.5">
                <img
                  className="w-7 h-7 rounded-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBLhCpXmZL1P1ZhNcA6lZtjQ6EyAKJwDh0MFFlolxTQ2K5bXRxCTP6AbPq2XEo0qdwLyRFVB_O6BsN0f2UV60u0Z4VT7O_GtWgAwRHKhmlh-V6-RC2gs7eDG3_ARfe0L7CvGZ2cp-eX5QH89Mpcbb6DEZwvi_9cwsAHv9Almvpf-J8EoMVQCuR8hb9QFKBFZYJiVSCr9uDCMYEr7M1kk0YT2AhOd16q09iVw9WRh3nnM24OIXALQut0Q"
                  alt="Elena Chen"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0051d5] text-white flex items-center justify-center text-[8px]">
                  <span className="material-symbols-outlined text-[9px]">send</span>
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#131b2e] leading-tight">
                  <strong className="font-semibold">Elena Chen</strong> shared feedback on{' '}
                  <strong className="font-semibold text-[#006b2c]">#auth-flow</strong>
                </p>
                <div className="bg-[#f2f3ff] rounded-lg p-2 mt-1.5">
                  <p className="text-xs text-[#3e4a3d] italic truncate">
                    "Token expiry policy verified. Ready to merge once Ravi approves."
                  </p>
                </div>
                <span className="text-[10px] text-[#6e7b6c] mt-1 block">8m ago</span>
              </div>
            </div>

            <div className="w-full h-px bg-[#eaedff]"></div>

            {/* Live item 2 */}
            <div
              onClick={onNavigateToQuestions}
              className="flex items-start gap-3 cursor-pointer"
            >
              <div className="relative shrink-0 mt-0.5">
                <img
                  className="w-7 h-7 rounded-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDC7tP4xiRFUM4OaspHgibpXksSz1chgTnPUaZn7-MnRRdAGIw3DGYvKUPpSxpyuUKZizlEYb1ALbZVtx8NgnIM2RgK3CdqXsEVG4l1iH9oq_ttMfQ_3jVq56RRheAA5kj1pAIsWoBhxnL5ZfRFFgLo59QklRpIRPKJKE1SYuy7KmQXYGmpbZua42quTX3-FXtJyu_CbWnuB0kSOmaNy4JvbbCNUYjX9mdE5HDmK7MC9p1qVh19-IuV1w"
                  alt="Marcus Vance"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#b15f00] text-white flex items-center justify-center text-[8px]">
                  <span className="material-symbols-outlined text-[9px]">help</span>
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#131b2e] leading-tight">
                  <strong className="font-semibold">Marcus Vance</strong> posted a question in{' '}
                  <strong className="font-semibold text-[#8d4b00]">#qna-general</strong>
                </p>
                <p className="text-xs text-[#131b2e] mt-1 truncate font-medium">
                  "What is our telemetry fallback when offline?"
                </p>
                <span className="text-[10px] text-[#6e7b6c] mt-1 block">24m ago</span>
              </div>
            </div>

            <div className="w-full h-px bg-[#eaedff]"></div>

            {/* Live item 3 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#eaedff] flex items-center justify-center shrink-0 text-[#00873a] mt-0.5">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#131b2e] leading-tight">
                  Sprint Goal <strong className="font-semibold">"API Gateway Latency"</strong> marked Done by{' '}
                  <strong className="font-semibold">DevOps Pod</strong>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eaedff] text-[#006b2c] font-semibold">
                    100% completed
                  </span>
                  <span className="text-[10px] text-[#6e7b6c]">42m ago</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Ask AI Button (Bottom Right) */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={onOpenAssistant}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00873a] text-white rounded-full shadow-lg active:scale-95 transition-all hover:bg-[#006b2c] cursor-pointer"
        >
          <span
            className="material-symbols-outlined text-[20px] text-[#7ffc97]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <span className="text-xs font-bold tracking-tight">Ask AI</span>
        </button>
      </div>
    </div>
  );
};
