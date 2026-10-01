import React from 'react';
import { ViewMode, User } from '../../types';
import { useSidebar } from '../../context/SidebarContext';

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
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();
  const [showPodDropdown, setShowPodDropdown] = React.useState(false);
  const [selectedPod, setSelectedPod] = React.useState(currentUser.pod || 'Core Engineering Pod');

  const pods = [
    { name: 'Core Engineering Pod', members: 24, active: true },
    { name: 'UI Foundations Pod', members: 18, active: false },
    { name: 'Backend Systems Pod', members: 12, active: false },
    { name: 'Design Systems Pod', members: 15, active: false },
  ];

  const renderNavItem = (
    view: ViewMode,
    label: string,
    icon: string,
    badge?: React.ReactNode,
    badgeText?: string,
    customIconColor?: string
  ) => {
    const isActive = currentView === view;
    return (
      <button
        key={view}
        type="button"
        onClick={() => {
          onSelectView(view);
          closeMobileSidebar();
        }}
        className={`relative group flex items-center rounded-[14px] text-[13px] font-medium transition-all text-left cursor-pointer w-full px-3.5 py-2.5 gap-2.5 ${
          isCollapsed ? 'lg:w-11 lg:h-11 lg:mx-auto lg:justify-center lg:px-0 lg:py-0' : ''
        } ${
          isActive
            ? 'bg-[#eaedff] text-[#006b2c] font-semibold shadow-2xs'
            : 'text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
        }`}
        aria-label={label}
      >
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${
            customIconColor || (isActive ? 'text-[#006b2c]' : '')
          }`}
        >
          {icon}
        </span>

        {/* Label: Always visible on mobile, conditioned on isCollapsed for desktop */}
        <div
          className={`flex items-center justify-between flex-1 min-w-0 ${
            isCollapsed ? 'lg:hidden' : 'flex'
          }`}
        >
          <span className="truncate">{label}</span>
          {badge}
        </div>

        {/* Indicator dot when collapsed on desktop if there is an unread badge */}
        {isCollapsed && badge && (
          <span className="hidden lg:block absolute top-2 right-2 w-2 h-2 rounded-full bg-[#006b2c] ring-2 ring-[#ffffff] dark:ring-[#131b2e]"></span>
        )}

        {/* Hover Tooltip when collapsed on desktop */}
        {isCollapsed && (
          <div className="hidden lg:flex absolute left-full ml-3 px-3 py-1.5 bg-[#131b2e] dark:bg-[#1a2333] text-white dark:text-[#eaedff] text-xs font-medium rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap items-center gap-2 border border-white/10 dark:border-[#2a364f]">
            <span>{label}</span>
            {badgeText && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#7ffc97] text-[#005320]">
                {badgeText}
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-[#131b2e]/50 backdrop-blur-xs z-40 transition-opacity animate-in fade-in"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-[270px] ${
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'
        } bg-[#ffffff] border-r border-[#eaedff] z-50 flex flex-col justify-between select-none shadow-xl lg:shadow-xs transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Brand / Logo Header */}
          <div
            className={`h-16 flex items-center border-b border-[#eaedff] transition-all duration-300 px-4 justify-between ${
              isCollapsed ? 'lg:justify-center lg:px-2' : ''
            }`}
          >
            {/* Logo text & mark */}
            <div
              className={`items-center gap-2.5 cursor-pointer min-w-0 flex ${
                isCollapsed ? 'lg:hidden' : 'flex'
              }`}
              onClick={() => {
                onSelectView('home');
                closeMobileSidebar();
              }}
            >
              <div className="w-8 h-8 rounded-xl bg-[#006b2c] flex items-center justify-center text-white shadow-xs shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="7" r="3"></circle>
                  <circle cx="6" cy="17" r="3"></circle>
                  <circle cx="18" cy="17" r="3"></circle>
                  <line x1="8.5" x2="10" y1="15.5" y2="9.5"></line>
                  <line x1="15.5" x2="14" y1="15.5" y2="9.5"></line>
                  <line x1="9" x2="15" y1="17" y2="17"></line>
                </svg>
              </div>
              <span className="font-semibold text-lg text-[#131b2e] tracking-tight truncate">
                TeamHub
              </span>
            </div>

            {/* Desktop Collapse Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden lg:flex items-center justify-center p-2 rounded-xl text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer group relative shrink-0"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isCollapsed ? 'menu' : 'menu_open'}
              </span>
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#131b2e] dark:bg-[#1a2333] text-white dark:text-[#eaedff] text-xs font-semibold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-white/10 dark:border-[#2a364f]">
                  Expand sidebar
                </div>
              )}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={closeMobileSidebar}
              className="lg:hidden p-2 rounded-xl text-[#6e7b6c] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors cursor-pointer shrink-0"
              title="Close navigation"
              aria-label="Close navigation"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Section Label: Workspace */}
          <div className={`px-4 py-2 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">
              Workspace
            </div>
          </div>
          {isCollapsed && <div className="hidden lg:block my-2 mx-3 border-t border-[#eaedff]/60" />}

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1 px-2">
            {renderNavItem('home', 'Home', 'home')}

            {renderNavItem(
              'tasks',
              'My Tasks',
              'check_circle',
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f2f3ff] text-[#6e7b6c] font-semibold">
                10
              </span>,
              '10'
            )}

            {renderNavItem(
              'channels',
              'Channels',
              'forum',
              <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>,
              'Unread'
            )}

            {renderNavItem(
              'questions',
              'Questions',
              'help_center',
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#2f1500] font-semibold">
                3
              </span>,
              '3'
            )}

            {renderNavItem('files', 'Files & Specs', 'folder')}

            {renderNavItem(
              'ai-assistant',
              'AI Assistant',
              'smart_toy',
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7ffc97] text-[#005320]">
                Beta
              </span>,
              'Beta',
              'text-[#006b2c]'
            )}

            {/* Reviews item: Visible ONLY to Team Lead and Administrator roles */}
            {(currentUser.role === 'lead' || currentUser.role === 'admin') &&
              renderNavItem(
                'reviews',
                'Reviews',
                'rule_folder',
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7ffc97] text-[#005320]">
                  3
                </span>,
                '3',
                'text-[#006b2c]'
              )}

            {/* Team item: Visible ONLY to Team Lead and Administrator roles */}
            {(currentUser.role === 'lead' || currentUser.role === 'admin') &&
              renderNavItem(
                'team',
                'Team',
                'groups',
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#eaedff] text-[#3e4a3d]">
                  {currentUser.role === 'admin' ? 'Directory' : 'Pod'}
                </span>,
                currentUser.role === 'admin' ? 'Directory' : 'Pod',
                'text-[#006b2c]'
              )}

            {/* Role-Specific Shortcuts Section */}
            <div className={`pt-2 mt-2 border-t border-[#eaedff]/80 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
              <div className="px-4 py-1 text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">
                Personal & Admin
              </div>
            </div>
            {isCollapsed && <div className="hidden lg:block my-2 mx-3 border-t border-[#eaedff]/60" />}

            {renderNavItem('my-work', 'Standup & Velocity', 'speed')}

            {currentUser.role === 'admin' && (
              <>
                {renderNavItem('admin-center', 'Admin Center', 'shield', undefined, undefined, 'text-[#8d4b00]')}

                {renderNavItem(
                  'manage-users',
                  'Manage Users',
                  'group',
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#ffdcc3] text-[#2f1500]">
                    3
                  </span>,
                  '3'
                )}
              </>
            )}

            {renderNavItem('profile-settings', 'Profile & Settings', 'manage_accounts')}
          </nav>
        </div>

        {/* Bottom Pod Selector Card */}
        <div
          className={`border-t border-[#eaedff] flex flex-col gap-2 relative transition-all p-3 ${
            isCollapsed ? 'lg:p-2 lg:items-center' : ''
          }`}
        >
          {showPodDropdown && (
            <div
              className={`absolute bottom-full mb-2 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xl p-2 flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 left-3 right-3 ${
                isCollapsed ? 'lg:left-2 lg:w-64' : ''
              }`}
            >
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider border-b border-[#eaedff] mb-1">
                Switch Workspace Pod
              </div>
              {pods.map((p) => (
                <button
                  key={p.name}
                  type="button"
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

          {/* Desktop Collapsed View */}
          {isCollapsed && (
            <div className="hidden lg:block relative group">
              <button
                type="button"
                onClick={() => setShowPodDropdown(!showPodDropdown)}
                className="w-11 h-11 rounded-[14px] bg-[#f2f3ff] border border-[#eaedff] hover:bg-[#eaedff] flex items-center justify-center font-bold text-xs text-[#006b2c] cursor-pointer transition-colors shadow-2xs"
                aria-label={selectedPod}
              >
                {selectedPod
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'TH'}
              </button>

              {/* Hover Tooltip when collapsed */}
              <div className="absolute left-full bottom-0 ml-3 px-3 py-1.5 bg-[#131b2e] dark:bg-[#1a2333] text-white dark:text-[#eaedff] text-xs font-semibold rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-white/10 dark:border-[#2a364f]">
                <div>{selectedPod}</div>
                <div className="text-[10px] text-[#7ffc97] font-normal">Active Pod · Click to switch</div>
              </div>
            </div>
          )}

          {/* Standard View (Mobile + Desktop Expanded) */}
          <div
            onClick={() => setShowPodDropdown(!showPodDropdown)}
            className={`flex items-center justify-between p-2 rounded-[14px] bg-[#f2f3ff] border border-[#eaedff] hover:bg-[#eaedff] transition-colors cursor-pointer ${
              isCollapsed ? 'lg:hidden' : 'flex'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center font-bold text-xs text-[#006b2c] shrink-0">
                TH
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-semibold text-[#131b2e] leading-tight truncate">
                  {selectedPod}
                </span>
                <span className="text-[11px] text-[#6e7b6c]">Active Pod</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-[#6e7b6c] shrink-0">
              {showPodDropdown ? 'expand_less' : 'unfold_more'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
