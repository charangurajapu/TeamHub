import React, { useState, useEffect } from 'react';
import { ViewMode, User, Task, ChannelMessage, Question, StandupEntry } from './types';
import { USERS, INITIAL_TASKS, INITIAL_CHANNEL_MESSAGES, INITIAL_QUESTIONS, STANDUP_ENTRIES } from './data/mockData';
import { getActiveAuthSession, signOutFromSupabaseAuth, AUTH_SESSION_STORAGE_KEY } from './lib/supabase';
import { useTheme, THEME_STORAGE_KEY } from './context/ThemeContext';
import { useSidebar } from './context/SidebarContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { AiDrawer } from './components/common/AiDrawer';
import { PhotoCropModal } from './components/common/PhotoCropModal';
import { CommandPaletteModal } from './components/common/CommandPaletteModal';
import { DatabaseFallbackToast } from './components/common/DatabaseFallbackToast';

// Desktop Screens
import { HomeDashboard } from './components/desktop/HomeDashboard';
import { ChannelsView } from './components/desktop/ChannelsView';
import { TasksKanbanView } from './components/desktop/TasksKanbanView';
import { QuestionsView } from './components/desktop/QuestionsView';
import { FilesView } from './components/desktop/FilesView';
import { AiAssistantView } from './components/desktop/AiAssistantView';
import { MyWorkView } from './components/desktop/MyWorkView';
import { AdminUsersView } from './components/desktop/AdminUsersView';
import { ProfileSettingsView } from './components/desktop/ProfileSettingsView';
import { WaitingApprovalView } from './components/desktop/WaitingApprovalView';
import { AuthView } from './components/desktop/AuthView';
import { ReviewsView } from './components/desktop/ReviewsView';
import { TeamView } from './components/desktop/TeamView';

export default function App() {
  const { setTheme: setAppTheme } = useTheme();
  const { isCollapsed } = useSidebar();
  const [viewMode, setViewMode] = useState<ViewMode>('home');

  // Supabase Auth states: starts with no active user until verified
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Master Users State Store (allows updating photos, names, roles, etc.)
  const [usersState, setUsersState] = useState<Record<string, User>>(USERS);

  // App-wide collections
  const [tasksState, setTasksState] = useState<Task[]>(INITIAL_TASKS);
  const [messagesState, setMessagesState] = useState<ChannelMessage[]>(INITIAL_CHANNEL_MESSAGES);
  const [questionsState, setQuestionsState] = useState<Question[]>(INITIAL_QUESTIONS);
  const [standupsState, setStandupsState] = useState<StandupEntry[]>(STANDUP_ENTRIES);

  // Global Modals / Drawers
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [aiDrawerPrompt, setAiDrawerPrompt] = useState<string | undefined>(undefined);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showPhotoCropModal, setShowPhotoCropModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

  const handleOpenAiDrawer = (prompt?: string) => {
    setAiDrawerPrompt(prompt);
    setShowAiDrawer(true);
  };

  // 1. On app load: Check for active Supabase Auth session
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const { user } = await getActiveAuthSession();
        if (!isMounted) return;

        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          // Restore user's saved theme preference if not overridden by local storage
          if (user.theme && !localStorage.getItem(THEME_STORAGE_KEY)) {
            setAppTheme(user.theme);
          }
          // Route to role-specific dashboard fetched from database
          if (user.role === 'admin') {
            setViewMode('admin-center');
          } else {
            setViewMode('home');
          }
        } else {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setViewMode('auth');
        }
      } catch (err) {
        console.warn('Initial Supabase auth check error:', err);
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setViewMode('auth');
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Working Logout handler: calls Supabase signOut, clears local state, and redirects to login
   */
  const handleLogout = async () => {
    await signOutFromSupabaseAuth();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setViewMode('auth');
  };

  /**
   * Developer Persona switcher (only available when VITE_DEV_MODE=true is set in env)
   */
  const handleSelectUser = (key: string) => {
    if (import.meta.env.VITE_DEV_MODE !== 'true') return;

    const selected = key === 'admin'
      ? { ...usersState.sarah, role: 'admin' as const, roleTitle: 'Workspace Administrator' }
      : usersState[key] || usersState.sarah;

    setCurrentUser(selected);
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
        user: selected,
        expiresAt: Date.now() + 86400000,
      }));
    } catch (e) {
      // ignore
    }

    if (key === 'admin') {
      setViewMode('admin-center');
    } else if (key === 'david') {
      setViewMode('home');
    } else if (key === 'anya') {
      setViewMode('my-work');
    } else if (key === 'ravi') {
      setViewMode('profile-settings');
    } else {
      setViewMode('home');
    }
  };

  /**
   * Updates user profile record and immediately propagates changes everywhere:
   * 1. Top bar & Header persona
   * 2. Chat messages in channels
   * 3. Task cards in sprint boards
   * 4. Standup feed cards
   * 5. Questions & Answers
   */
  const handleUpdateActiveUser = (updated: Partial<User>) => {
    if (!currentUser) return;

    // Compute updated initials if name changed
    let initials = currentUser.initials;
    if (updated.name && updated.name !== currentUser.name) {
      const parts = updated.name.trim().split(' ');
      initials = parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    }

    const newUser: User = {
      ...currentUser,
      ...updated,
      initials,
    };

    setCurrentUser(newUser);

    if (updated.theme) {
      setAppTheme(updated.theme);
    }

    // Save updated session to local cache
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
        user: newUser,
        expiresAt: Date.now() + 86400000,
      }));
    } catch (e) {
      // ignore
    }

    // 1. Update user dictionary
    setUsersState((prev) => ({
      ...prev,
      [newUser.id]: newUser,
    }));

    // 2. Update all task cards assigned to or reviewed by user
    setTasksState((prev) =>
      prev.map((t) => {
        let modified = false;
        let assignee = t.assignee;
        let reviewer = t.reviewer;

        if (t.assignee.id === newUser.id) {
          assignee = newUser;
          modified = true;
        }
        if (t.reviewer && t.reviewer.id === newUser.id) {
          reviewer = newUser;
          modified = true;
        }

        return modified ? { ...t, assignee, reviewer } : t;
      })
    );

    // 3. Update all channel messages authored by user
    setMessagesState((prev) =>
      prev.map((msg) =>
        msg.author.id === newUser.id ? { ...msg, author: newUser } : msg
      )
    );

    // 4. Update standup stream
    setStandupsState((prev) =>
      prev.map((s) =>
        s.user.id === newUser.id ? { ...s, user: newUser } : s
      )
    );

    // 5. Update questions & answers
    setQuestionsState((prev) =>
      prev.map((q) => {
        const qAuthor = q.author.id === newUser.id ? newUser : q.author;
        const qAnswers = q.answers.map((a) =>
          a.author.id === newUser.id ? { ...a, author: newUser } : a
        );
        return { ...q, author: qAuthor, answers: qAnswers };
      })
    );
  };

  // Route protection guard: Team directory is strictly blocked for Team Members
  useEffect(() => {
    if (viewMode === 'team' && currentUser && currentUser.role !== 'admin' && currentUser.role !== 'lead') {
      setViewMode('home');
    }
  }, [viewMode, currentUser]);

  const handleNavigate = (view: ViewMode, itemId?: string) => {
    if (view === 'team' && currentUser?.role !== 'admin' && currentUser?.role !== 'lead') {
      setViewMode('home');
      return;
    }
    setViewMode(view);
    if (view === 'tasks' && itemId) setSelectedTaskId(itemId);
    if (view === 'questions' && itemId) setSelectedQuestionId(itemId);
  };

  // ============================================================
  // AUTH CHECK LOADING SCREEN
  // ============================================================
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#006b2c] dark:bg-[#22c55e] text-white dark:text-[#003915] flex items-center justify-center font-bold text-lg shadow-md animate-pulse">
          TH
        </div>
        <p className="mt-4 text-xs font-semibold text-[#3e4a3d] dark:text-[#bcc7de] animate-pulse">
          Connecting to Supabase Auth...
        </p>
      </div>
    );
  }

  // ============================================================
  // PROTECTED ROUTE GUARD: If logged out, render ONLY Auth flows
  // No protected views (tasks, channels, admin center) can render
  // ============================================================
  if (!isAuthenticated || !currentUser) {
    if (viewMode === 'waiting-approval') {
      return (
        <WaitingApprovalView
          onBackToApp={() => {
            setViewMode('auth');
          }}
        />
      );
    }

    return (
      <AuthView
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setUsersState((prev) => ({
            ...prev,
            [user.id]: user,
          }));

          // Fetch user's role from database and route to the correct dashboard
          if (user.role === 'admin') {
            setViewMode('admin-center');
          } else if (user.role === 'lead') {
            setViewMode('home');
          } else {
            setViewMode('home');
          }
        }}
        onWaitingApproval={() => setViewMode('waiting-approval')}
        knownUsers={usersState}
      />
    );
  }



  // ============================================================
  // RENDER FULL DESKTOP WORKSPACE VIEW (AUTHENTICATED)
  // ============================================================
  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col antialiased">
      {/* Fixed Left Sidebar */}
      <Sidebar
        currentView={viewMode}
        onSelectView={handleNavigate}
        currentUser={currentUser}
      />

      {/* Top Fixed Header with Profile Menu & Working Logout */}
      <Header
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onSelectUser={handleSelectUser}
        users={usersState}
        onOpenAiDrawer={() => setShowAiDrawer(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onQuickNewTask={() => setViewMode('tasks')}
      />

      {/* Main Content Stage */}
      <div
        className={`pt-16 flex-1 flex flex-col transition-[padding] duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
        }`}
      >
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {viewMode === 'home' && (
            <HomeDashboard
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onOpenAiDrawer={() => setShowAiDrawer(true)}
              onQuickNewTask={() => setViewMode('tasks')}
            />
          )}

          {viewMode === 'tasks' && (
            <TasksKanbanView
              currentUser={currentUser}
              onOpenAiDrawer={() => setShowAiDrawer(true)}
              selectedTaskId={selectedTaskId}
            />
          )}

          {viewMode === 'channels' && (
            <ChannelsView
              currentUser={currentUser}
              onOpenAiDrawer={() => setShowAiDrawer(true)}
              onViewTasksForUser={() => setViewMode('tasks')}
              onOpenSpecDoc={() => setViewMode('files')}
            />
          )}

          {viewMode === 'questions' && (
            <QuestionsView
              currentUser={currentUser}
              onOpenAiDrawer={handleOpenAiDrawer}
              selectedQuestionId={selectedQuestionId}
            />
          )}

          {viewMode === 'files' && (
            <FilesView
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {viewMode === 'ai-assistant' && (
            <AiAssistantView
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {viewMode === 'my-work' && (
            <MyWorkView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onOpenPhotoModal={() => setShowPhotoCropModal(true)}
            />
          )}

          {viewMode === 'admin-center' && (
            currentUser.role === 'admin' ? (
              <HomeDashboard
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onOpenAiDrawer={handleOpenAiDrawer}
                onQuickNewTask={() => setViewMode('tasks')}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-[#ffffff] rounded-2xl border border-[#eaedff] text-center max-w-md mx-auto my-8">
                <span className="material-symbols-outlined text-[32px] text-[#ba1a1a] mb-2">shield_person</span>
                <p className="text-xs text-[#ba1a1a] font-semibold">
                  Access Denied: Admin Center is restricted to Administrators.
                </p>
              </div>
            )
          )}

          {viewMode === 'manage-users' && (
            currentUser.role === 'admin' ? (
              <AdminUsersView currentUser={currentUser} />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-[#ffffff] rounded-2xl border border-[#eaedff] text-center max-w-md mx-auto my-8">
                <span className="material-symbols-outlined text-[32px] text-[#ba1a1a] mb-2">shield_person</span>
                <p className="text-xs text-[#ba1a1a] font-semibold">
                  Access Denied: User Management is restricted to Administrators.
                </p>
              </div>
            )
          )}

          {viewMode === 'profile-settings' && (
            <ProfileSettingsView
              currentUser={currentUser}
              onOpenPhotoModal={() => setShowPhotoCropModal(true)}
              onUpdateUser={handleUpdateActiveUser}
              onRemovePhoto={() => handleUpdateActiveUser({ avatarUrl: '' })}
            />
          )}

          {viewMode === 'reviews' && (
            <ReviewsView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onTaskUpdated={(updatedTask) => {
                setTasksState((prev) =>
                  prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
                );
              }}
            />
          )}

          {viewMode === 'team' && (
            currentUser.role === 'admin' || currentUser.role === 'lead' ? (
              <TeamView
                currentUser={currentUser}
                onNavigate={handleNavigate}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-[#ffffff] rounded-2xl border border-[#eaedff] text-center max-w-md mx-auto my-8">
                <span className="material-symbols-outlined text-[32px] text-[#ba1a1a] mb-2">shield_person</span>
                <p className="text-xs text-[#ba1a1a] font-semibold">
                  Access Denied: Team Directory is restricted to Team Leads and Administrators.
                </p>
              </div>
            )
          )}
        </main>
      </div>

      {/* Global Slide-out AI Assistant Drawer (Accessible anywhere) */}
      <AiDrawer
        isOpen={showAiDrawer}
        onClose={() => {
          setShowAiDrawer(false);
          setAiDrawerPrompt(undefined);
        }}
        currentUser={currentUser || undefined}
        onNavigate={handleNavigate}
        onInsertToTask={() => setViewMode('tasks')}
        onPostToStandup={() => setViewMode('my-work')}
        initialPrompt={aiDrawerPrompt}
      />

      {/* Profile Photo Crop & Adjust Modal (4-step flow) */}
      <PhotoCropModal
        isOpen={showPhotoCropModal}
        onClose={() => setShowPhotoCropModal(false)}
        currentUser={currentUser}
        onSavePhoto={(photoUrl) => handleUpdateActiveUser({ avatarUrl: photoUrl })}
        onRemovePhoto={() => handleUpdateActiveUser({ avatarUrl: '' })}
      />

      {/* Global Quick Command Palette (Cmd+K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={handleNavigate}
      />

      {/* Global Database Fallback Alert Toast */}
      <DatabaseFallbackToast />
    </div>
  );
}
