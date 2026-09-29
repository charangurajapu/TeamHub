import React, { useState, useEffect } from 'react';
import { ViewMode, DeviceMode, User, Task, ChannelMessage, Question, StandupEntry } from './types';
import { USERS, INITIAL_TASKS, INITIAL_CHANNEL_MESSAGES, INITIAL_QUESTIONS, STANDUP_ENTRIES } from './data/mockData';
import { getActiveAuthSession, signOutFromSupabaseAuth, AUTH_SESSION_STORAGE_KEY } from './lib/supabase';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { AiDrawer } from './components/common/AiDrawer';
import { PhotoCropModal } from './components/common/PhotoCropModal';
import { CommandPaletteModal } from './components/common/CommandPaletteModal';

// Mobile Screens
import { MobileFrame } from './components/mobile/MobileFrame';
import { MobileTabBar } from './components/mobile/MobileTabBar';
import { MobileHomeScreen } from './components/mobile/MobileHomeScreen';
import { MobileChannelsScreen } from './components/mobile/MobileChannelsScreen';
import { MobileTasksScreen } from './components/mobile/MobileTasksScreen';
import { MobileQuestionsScreen } from './components/mobile/MobileQuestionsScreen';
import { MobileAssistantScreen } from './components/mobile/MobileAssistantScreen';

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

export default function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [mobileTab, setMobileTab] = useState<'home' | 'tasks' | 'channels' | 'questions' | 'ai-assistant'>('home');

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
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showPhotoCropModal, setShowPhotoCropModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

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
   * Developer Persona switcher (only available when Dev Mode is explicitly toggled ON)
   */
  const handleSelectUser = (key: string) => {
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

  const handleNavigate = (view: ViewMode, itemId?: string) => {
    setViewMode(view);
    if (view === 'tasks' && itemId) setSelectedTaskId(itemId);
    if (view === 'questions' && itemId) setSelectedQuestionId(itemId);
  };

  // ============================================================
  // AUTH CHECK LOADING SCREEN
  // ============================================================
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#006b2c] text-white flex items-center justify-center font-bold text-lg shadow-md animate-pulse">
          TH
        </div>
        <p className="mt-4 text-xs font-semibold text-[#3e4a3d] animate-pulse">
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
  // RENDER REACT NATIVE MOBILE PROTOTYPE MODE (AUTHENTICATED)
  // ============================================================
  if (deviceMode === 'mobile-framed' || deviceMode === 'mobile-full') {
    const mobileContent = (
      <div className="relative w-full min-h-screen bg-[#faf8ff] text-[#131b2e]">
        {mobileTab === 'home' && (
          <MobileHomeScreen
            currentUser={currentUser}
            onOpenAssistant={() => setMobileTab('ai-assistant')}
            onNavigateToTasks={() => setMobileTab('tasks')}
            onNavigateToChannel={() => setMobileTab('channels')}
            onNavigateToQuestions={() => setMobileTab('questions')}
            onLogout={handleLogout}
          />
        )}

        {mobileTab === 'channels' && (
          <MobileChannelsScreen
            currentUser={currentUser}
            onOpenThread={() => {
              setDeviceMode('desktop');
              setViewMode('channels');
            }}
            onOpenSpecPreview={() => {
              setDeviceMode('desktop');
              setViewMode('files');
            }}
          />
        )}

        {mobileTab === 'tasks' && (
          <MobileTasksScreen
            onSelectTask={(task: Task) => {
              setSelectedTaskId(task.id);
              setDeviceMode('desktop');
              setViewMode('tasks');
            }}
            onNewTask={() => {
              setDeviceMode('desktop');
              setViewMode('tasks');
            }}
          />
        )}

        {mobileTab === 'questions' && (
          <MobileQuestionsScreen
            onSelectQuestion={(q) => {
              setSelectedQuestionId(q.id);
              setDeviceMode('desktop');
              setViewMode('questions');
            }}
            onAskQuestion={() => {
              setDeviceMode('desktop');
              setViewMode('questions');
            }}
          />
        )}

        {mobileTab === 'ai-assistant' && <MobileAssistantScreen />}

        {/* Persistent Bottom Tab Bar */}
        <MobileTabBar currentTab={mobileTab} onSelectTab={setMobileTab} />
      </div>
    );

    if (deviceMode === 'mobile-framed') {
      return (
        <MobileFrame onExitMobile={() => setDeviceMode('desktop')}>
          {mobileContent}
        </MobileFrame>
      );
    }

    return (
      <div className="w-full min-h-screen bg-[#faf8ff]">
        <div className="fixed top-2 right-2 z-50">
          <button
            onClick={() => setDeviceMode('desktop')}
            className="px-3 py-1.5 rounded-full bg-[#006b2c] text-white text-xs font-semibold shadow-lg cursor-pointer"
          >
            Desktop Mode
          </button>
        </div>
        {mobileContent}
      </div>
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
        onSelectView={setViewMode}
        currentUser={currentUser}
      />

      {/* Top Fixed Header with Profile Menu & Working Logout */}
      <Header
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onSelectUser={handleSelectUser}
        users={usersState}
        deviceMode={deviceMode}
        onSelectDeviceMode={setDeviceMode}
        onOpenAiDrawer={() => setShowAiDrawer(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onQuickNewTask={() => setViewMode('tasks')}
      />

      {/* Main Content Stage */}
      <div className="lg:pl-[260px] pt-16 flex-1 flex flex-col">
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
              onOpenAiDrawer={() => setShowAiDrawer(true)}
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
            <HomeDashboard
              currentUser={{ ...currentUser, role: 'admin' }}
              onNavigate={handleNavigate}
              onOpenAiDrawer={() => setShowAiDrawer(true)}
              onQuickNewTask={() => setViewMode('tasks')}
            />
          )}

          {viewMode === 'manage-users' && <AdminUsersView currentUser={currentUser} />}

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
        </main>
      </div>

      {/* Global Slide-out AI Assistant Drawer (Accessible anywhere) */}
      <AiDrawer
        isOpen={showAiDrawer}
        onClose={() => setShowAiDrawer(false)}
        currentUser={currentUser || undefined}
        onNavigate={handleNavigate}
        onInsertToTask={() => setViewMode('tasks')}
        onPostToStandup={() => setViewMode('my-work')}
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
    </div>
  );
}
