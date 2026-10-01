import React, { useState } from 'react';
import { User, ViewMode } from '../../types';
import { useSidebar } from '../../context/SidebarContext';

interface HeaderProps {
  currentUser: User;
  onNavigate: (view: ViewMode, itemId?: string) => void;
  onLogout: () => void;
  onSelectUser?: (userKey: string) => void;
  users?: Record<string, User>;
  onOpenAiDrawer: () => void;
  onOpenCommandPalette: () => void;
  onQuickNewTask: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onNavigate,
  onLogout,
  onSelectUser,
  onOpenAiDrawer,
  onOpenCommandPalette,
  onQuickNewTask,
}) => {
  const { isCollapsed, toggleMobileSidebar } = useSidebar();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 ${
        isCollapsed ? 'lg:left-[72px]' : 'lg:left-[260px]'
      } h-16 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#eaedff] z-40 px-3 sm:px-6 md:px-8 flex items-center justify-between shadow-xs transition-[left] duration-300 ease-in-out`}
    >
      {/* Left Area: Mobile Menu Trigger + Search Bar */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xl md:max-w-2xl">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="lg:hidden flex items-center justify-center p-2 rounded-xl text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer shrink-0"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="relative w-full flex items-center text-left py-2 pl-9 sm:pl-10 pr-12 sm:pr-20 rounded-[14px] bg-[#f2f3ff] border border-[#eaedff] text-[13px] sm:text-[14px] text-[#3e4a3d] hover:border-[#006b2c] hover:bg-[#ffffff] transition-all cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined absolute left-3 text-[#6e7b6c] text-[18px] sm:text-[20px] pointer-events-none">
            search
          </span>
          <span className="truncate text-[#6e7b6c]">Search tasks, channels, docs...</span>
          <div className="absolute right-2.5 hidden sm:flex items-center gap-0.5 px-2 py-0.5 rounded border border-[#eaedff] bg-[#ffffff] text-[11px] font-semibold text-[#3e4a3d] shadow-2xs pointer-events-none">
            <span>⌘</span>
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right Controls: Quick Actions, AI Assistant, Notifications, Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
        {/* Quick New Action */}
        <button
          type="button"
          onClick={onQuickNewTask}
          className="flex items-center gap-1 px-3 py-1.5 rounded-[12px] bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-[17px]">add</span>
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Ask AI Pill Button */}
        <button
          type="button"
          onClick={onOpenAiDrawer}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#7ffc97]/30 hover:bg-[#7ffc97]/50 text-[#005320] text-xs font-semibold transition-colors cursor-pointer"
          title="Open AI Assistant Drawer"
        >
          <span className="material-symbols-outlined text-[17px] text-[#006b2c]">auto_awesome</span>
          <span>AI Assistant</span>
        </button>

        {/* Notifications Icon with Indicator */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setNotificationsRead(true);
            }}
            className="relative p-2 rounded-[12px] text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {!notificationsRead && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#006b2c] ring-2 ring-[#ffffff]"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#ffffff] shadow-xl border border-[#eaedff] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#eaedff] px-1">
                <span className="font-semibold text-xs text-[#131b2e]">Notifications</span>
                <span className="text-[11px] text-[#006b2c] font-medium">Mark all read</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                {/* Notification 1: David Kim on #backend-104 */}
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigate('channels', 'backend-104');
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] flex items-start gap-2.5 transition-colors cursor-pointer group"
                >
                  <span className="w-2 h-2 rounded-full bg-[#006b2c] mt-1 shrink-0"></span>
                  <div>
                    <p className="text-[#131b2e] leading-snug">
                      <strong className="font-semibold">David Kim</strong> commented on{' '}
                      <span className="text-[#006b2c] font-medium underline group-hover:text-[#00873a]">#backend-104</span>
                    </p>
                    <span className="text-[10px] text-[#6e7b6c] mt-0.5 block">25m ago • Click to open & highlight channel thread</span>
                  </div>
                </button>

                {/* Notification 2: Sprint 42 milestone tasks */}
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigate('tasks', 'task-101');
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-[#ffffff] hover:bg-[#f2f3ff] transition-colors flex items-start gap-2.5 cursor-pointer group border border-transparent hover:border-[#eaedff]"
                >
                  <span className="w-2 h-2 rounded-full bg-[#0051d5] mt-1 shrink-0"></span>
                  <div>
                    <p className="text-[#131b2e] leading-snug">
                      Sprint 42 milestone goal achieved:{' '}
                      <strong className="font-medium text-[#0051d5] underline">18 tasks completed</strong>
                    </p>
                    <span className="text-[10px] text-[#6e7b6c] mt-0.5 block">1h ago • Click to open & highlight Sprint 42 board</span>
                  </div>
                </button>

                {/* Notification 3: Elena Chen on Question Q-4823 */}
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigate('questions', 'q-4823');
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-[#ffffff] hover:bg-[#f2f3ff] transition-colors flex items-start gap-2.5 cursor-pointer group border border-transparent hover:border-[#eaedff]"
                >
                  <span className="w-2 h-2 rounded-full bg-[#8d4b00] mt-1 shrink-0"></span>
                  <div>
                    <p className="text-[#131b2e] leading-snug">
                      <strong className="font-semibold">Elena Chen</strong> marked question{' '}
                      <span className="text-[#006b2c] font-medium underline">Q-4823</span> resolved
                    </p>
                    <span className="text-[10px] text-[#6e7b6c] mt-0.5 block">2h ago • Click to open & highlight resolved question</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-[#eaedff]"></div>

        {/* Current User Profile Menu Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] border border-[#eaedff] transition-all cursor-pointer"
            title="User Profile Menu"
          >
            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-[#7ffc97] text-[#002109] font-bold text-xs flex items-center justify-center shadow-xs">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.initials
              )}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#006b2c] ring-1 ring-white"></span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-[#131b2e] leading-none truncate max-w-[90px] sm:max-w-[110px]">
                {currentUser.name}
              </span>
              <span className="text-[10px] font-medium text-[#3e4a3d] capitalize leading-none mt-0.5">
                {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'lead' ? 'Team Lead' : 'Member'}
              </span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">
              {showUserDropdown ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Profile & Settings Dropdown Menu */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#ffffff] shadow-2xl border border-[#eaedff] p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Profile Card Header */}
              <div className="p-3 border-b border-[#eaedff] flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[#7ffc97] text-[#002109] font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.initials
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#006b2c] ring-2 ring-white"></span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#131b2e] truncate">{currentUser.name}</span>
                  </div>
                  <span className="text-[11px] text-[#6e7b6c] truncate">{currentUser.email}</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
                        currentUser.role === 'admin'
                          ? 'bg-[#ffdcc3] text-[#8d4b00]'
                          : currentUser.role === 'lead'
                          ? 'bg-[#dbe1ff] text-[#0051d5]'
                          : 'bg-[#d8f8dc] text-[#006b2c]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[10px]">
                        {currentUser.role === 'admin' ? 'shield' : currentUser.role === 'lead' ? 'verified_user' : 'person'}
                      </span>
                      <span>
                        {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'lead' ? 'Team Lead' : 'Team Member'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Menu Options */}
              <div className="py-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('profile-settings');
                    setShowUserDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-[#131b2e] text-xs font-medium transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">manage_accounts</span>
                  <span>Profile & Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('my-work');
                    setShowUserDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-[#131b2e] text-xs font-medium transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">task_alt</span>
                  <span>My Work & Standup</span>
                </button>

                {(currentUser.role === 'lead' || currentUser.role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('reviews');
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-[#131b2e] text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#006b2c]">rule_folder</span>
                    <span>Reviews &amp; Deliverables</span>
                  </button>
                )}

                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('admin-center');
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-[#131b2e] text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#8d4b00]">admin_panel_settings</span>
                    <span>Admin Center</span>
                  </button>
                )}
              </div>

              {/* Developer Persona Switcher: Only rendered if VITE_DEV_MODE=true is explicitly set in environment */}
              {import.meta.env.VITE_DEV_MODE === 'true' && onSelectUser && (
                <div className="border-t border-[#eaedff] pt-2 pb-1 px-1">
                  <div className="p-1 bg-[#f2f3ff] rounded-xl border border-[#eaedff]">
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#8d4b00] uppercase tracking-wider flex items-center justify-between">
                      <span>Switch Persona (Dev Only)</span>
                      <span className="px-1 rounded bg-[#ffdcc3] text-[#8d4b00] text-[9px]">DEV</span>
                    </div>

                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectUser('sarah');
                          setShowUserDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          currentUser.id === 'user-sarah' && currentUser.role === 'member'
                            ? 'bg-[#eaedff] text-[#006b2c] font-semibold'
                            : 'hover:bg-white text-[#131b2e]'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-[#7ffc97] text-[#002109] text-[10px] font-semibold flex items-center justify-center shrink-0">
                          SC
                        </div>
                        <span className="truncate text-xs">Sarah Connor (Member)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectUser('david');
                          setShowUserDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          currentUser.id === 'user-david'
                            ? 'bg-[#eaedff] text-[#006b2c] font-semibold'
                            : 'hover:bg-white text-[#131b2e]'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-[#dbe1ff] text-[#00174b] text-[10px] font-semibold flex items-center justify-center shrink-0">
                          DK
                        </div>
                        <span className="truncate text-xs">David Kim (Lead)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectUser('admin');
                          setShowUserDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          currentUser.role === 'admin'
                            ? 'bg-[#eaedff] text-[#006b2c] font-semibold'
                            : 'hover:bg-white text-[#131b2e]'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-[#ffdcc3] text-[#2f1500] text-[10px] font-semibold flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[11px]">shield</span>
                        </div>
                        <span className="truncate text-xs">Sarah Connor (Admin)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Working Logout Button */}
              <div className="border-t border-[#eaedff] pt-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-[18px] text-red-500 group-hover:text-red-700">logout</span>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
