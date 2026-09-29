import React from 'react';
import { ViewMode, User } from '../../types';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  currentUser: User;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentUser,
}) => {
  const [showPodDropdown, setShowPodDropdown] = React.useState(false);
  const [selectedPod, setSelectedPod] = React.useState(currentUser.pod || 'Core Engineering Pod');

  const pods = [
    { name: 'Core Engineering Pod', members: 24, active: true },
    { name: 'UI Foundations Pod', members: 18, active: false },
    { name: 'Backend Systems Pod', members: 12, active: false },
    { name: 'Design Systems Pod', members: 15, active: false },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-[#ffffff] border-r border-[#eaedff] z-50 flex flex-col justify-between select-none shadow-xs">
      <div className="flex flex-col">
        {/* Brand / Logo Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#eaedff]">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onSelectView('home')}>
            <div className="w-8 h-8 rounded-xl bg-[#006b2c] flex items-center justify-center text-white shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="3"></circle>
                <circle cx="6" cy="17" r="3"></circle>
                <circle cx="18" cy="17" r="3"></circle>
                <line x1="8.5" x2="10" y1="15.5" y2="9.5"></line>
                <line x1="15.5" x2="14" y1="15.5" y2="9.5"></line>
                <line x1="9" x2="15" y1="17" y2="17"></line>
              </svg>
            </div>
            <span className="font-semibold text-lg text-[#131b2e] tracking-tight">TeamHub</span>
          </div>
          <button 
            className="flex items-center justify-center p-1.5 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer" 
            title="Workspace"
          >
            <span className="material-symbols-outlined text-[20px]">menu_open</span>
          </button>
        </div>

        {/* Section Label */}
        <div className="px-4 py-2">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">
            Workspace
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-2 flex flex-col gap-1">
          <button
            onClick={() => onSelectView('home')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'home'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">home</span>
            <span>Home</span>
          </button>

          <button
            onClick={() => onSelectView('tasks')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'tasks'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <div className="flex items-center justify-between flex-1">
              <span>My Tasks</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f2f3ff] text-[#6e7b6c] font-semibold">
                10
              </span>
            </div>
          </button>

          <button
            onClick={() => onSelectView('channels')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'channels'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">forum</span>
            <div className="flex items-center justify-between flex-1">
              <span>Channels</span>
              <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>
            </div>
          </button>

          <button
            onClick={() => onSelectView('questions')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'questions'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">help_center</span>
            <div className="flex items-center justify-between flex-1">
              <span>Questions</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#2f1500] font-semibold">
                3
              </span>
            </div>
          </button>

          <button
            onClick={() => onSelectView('files')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'files'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">folder</span>
            <span>Files & Specs</span>
          </button>

          <button
            onClick={() => onSelectView('ai-assistant')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'ai-assistant'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-[#006b2c]">smart_toy</span>
              <span>AI Assistant</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7ffc97] text-[#005320]">
              Beta
            </span>
          </button>

          {/* Reviews item: Visible ONLY to Team Lead and Administrator roles */}
          {(currentUser.role === 'lead' || currentUser.role === 'admin') && (
            <button
              onClick={() => onSelectView('reviews')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
                currentView === 'reviews'
                  ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                  : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#006b2c]">rule_folder</span>
                <span>Reviews</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7ffc97] text-[#005320]">
                3
              </span>
            </button>
          )}

          {/* Role-Specific Shortcuts */}
          <div className="pt-2 mt-2 border-t border-[#eaedff]/80">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">
              Personal & Admin
            </div>
          </div>

          <button
            onClick={() => onSelectView('my-work')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'my-work'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">speed</span>
            <span>Standup & Velocity</span>
          </button>

          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => onSelectView('admin-center')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
                  currentView === 'admin-center'
                    ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                    : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
                }`}
              >
                <span className="material-symbols-outlined text-[19px] text-[#8d4b00]">shield</span>
                <span>Admin Center</span>
              </button>

              <button
                onClick={() => onSelectView('manage-users')}
                className={`flex items-center justify-between px-3.5 py-2 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
                  currentView === 'manage-users'
                    ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                    : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[19px]">group</span>
                  <span>Manage Users</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#ffdcc3] text-[#2f1500]">
                  3
                </span>
              </button>
            </>
          )}

          <button
            onClick={() => onSelectView('profile-settings')}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer ${
              currentView === 'profile-settings'
                ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
                : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">manage_accounts</span>
            <span>Profile & Settings</span>
          </button>
        </nav>
      </div>

      {/* Bottom Pod Selector Card */}
      <div className="p-3 border-t border-[#eaedff] flex flex-col gap-2 relative">
        {showPodDropdown && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xl p-2 flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider border-b border-[#eaedff] mb-1">
              Switch Workspace Pod
            </div>
            {pods.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setSelectedPod(p.name);
                  setShowPodDropdown(false);
                }}
                className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                  selectedPod === p.name
                    ? 'bg-[#eaedff] text-[#006b2c] font-bold'
                    : 'text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] text-[#6e7b6c]">{p.members} Members</span>
                </div>
                {selectedPod === p.name && (
                  <span className="material-symbols-outlined text-[16px] text-[#006b2c]">check</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div
          onClick={() => setShowPodDropdown(!showPodDropdown)}
          className="flex items-center justify-between p-2 rounded-[14px] bg-[#f2f3ff] border border-[#eaedff] hover:bg-[#eaedff] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center font-bold text-xs text-[#006b2c]">
              TH
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-semibold text-[#131b2e] leading-tight truncate">
                {selectedPod}
              </span>
              <span className="text-[11px] text-[#6e7b6c]">Active Pod</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#6e7b6c]">
            {showPodDropdown ? 'expand_less' : 'unfold_more'}
          </span>
        </div>
      </div>
    </aside>
  );
};
