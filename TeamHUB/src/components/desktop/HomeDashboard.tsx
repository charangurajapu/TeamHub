import React, { useState, useEffect } from 'react';
import { User, Task, Question, StandupEntry, ViewMode, Project, Channel, JoinRequest } from '../../types';
import { STANDUP_ENTRIES, INITIAL_TASKS, JOIN_REQUESTS, INITIAL_PROJECTS, USERS } from '../../data/mockData';
import { getActiveWorkspace, fetchProjectsFromDb, createProjectInDb, isSupabaseConfigured, fetchTasksFromDb, fetchJoinRequestsFromDb, fetchStandupsFromDb, fetchQuestionsFromDb, fetchProfilesCountFromDb, fetchWorkspaceFilesFromDb, fetchChannelsFromDb } from '../../lib/supabase';

interface HomeDashboardProps {
  currentUser: User;
  onNavigate: (view: ViewMode, itemId?: string) => void;
  onOpenAiDrawer: () => void;
  onQuickNewTask: () => void;
}

const POD_OPTIONS = [
  { id: 'core', name: 'Core Engineering', label: 'Core Engineering • 24 members', membersCount: 24 },
  { id: 'design', name: 'Product Design Systems', label: 'Product Design Systems • 8 members', membersCount: 8 },
  { id: 'mobile', name: 'Mobile Platform Pod', label: 'Mobile Platform Pod • 14 members', membersCount: 14 },
  { id: 'infra', name: 'Infrastructure & Data', label: 'Infrastructure & Data • 11 members', membersCount: 11 },
];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  currentUser,
  onNavigate,
  onOpenAiDrawer,
  onQuickNewTask,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [standups, setStandups] = useState<StandupEntry[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [activeSeatsCount, setActiveSeatsCount] = useState<number>(0);
  const [filesCount, setFilesCount] = useState<number>(0);
  const [channelsCount, setChannelsCount] = useState<number>(0);
  const [unblockedDavid, setUnblockedDavid] = useState(false);
  const [adminPodCode, setAdminPodCode] = useState<string>('TH-4821-ENG');
  const [adminPodCopied, setAdminPodCopied] = useState(false);

  // New Project Modal & Form State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('Q4 Unified Design Tokens & Engine');
  const [newProjectDesc, setNewProjectDesc] = useState(
    'Centralize color primitives, typography scale tokens, and motion timings across web and iOS surfaces. Aiming for full team-wide sync by Cycle 16.'
  );
  const [newProjectPodId, setNewProjectPodId] = useState('core');
  const [newProjectTargetDate, setNewProjectTargetDate] = useState('Nov 28, 2024 (Sprint End)');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [projectSuccessNotice, setProjectSuccessNotice] = useState<string | null>(null);

  // Project card dropdown state
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [projectActionToast, setProjectActionToast] = useState<string | null>(null);

  // Close project dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = () => setOpenProjectMenuId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenProjectMenuId(null);
      }
    };

    if (openProjectMenuId) {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [openProjectMenuId]);

  // Permission gate: + New Project visible to Team Lead and Administrator
  const canCreateProject = currentUser.role === 'lead' || currentUser.role === 'admin';

  // Fetch live projects and workspaces on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (currentUser.role === 'admin') {
        const ws = await getActiveWorkspace(currentUser.email);
        if (isMounted && ws?.pod_code) setAdminPodCode(ws.pod_code);
      }

      const dbProjects = await fetchProjectsFromDb(currentUser);
      if (isMounted && dbProjects) {
        setProjects(dbProjects);
      }

      if (isSupabaseConfigured) {
        const dbTasks = await fetchTasksFromDb();
        if (isMounted && dbTasks) {
          setAllTasks(dbTasks);
          setTasks(dbTasks.slice(0, 4));
        }
      }

      if (currentUser.role === 'admin') {
        const joinRes = await fetchJoinRequestsFromDb(currentUser);
        if (isMounted && joinRes.data) {
          setJoinRequests(joinRes.data);
        }
      }

      const dbStandups = await fetchStandupsFromDb();
      if (isMounted && dbStandups) {
        setStandups(dbStandups);
      }

      const dbQuestions = await fetchQuestionsFromDb();
      if (isMounted && dbQuestions) {
        setQuestions(dbQuestions);
      }

      const profilesCount = await fetchProfilesCountFromDb();
      if (isMounted) {
        setActiveSeatsCount(profilesCount);
      }

      const dbFiles = await fetchWorkspaceFilesFromDb();
      if (isMounted && dbFiles) {
        setFilesCount(dbFiles.length);
      }

      const dbChannels = await fetchChannelsFromDb();
      if (isMounted && dbChannels) {
        setChannelsCount(dbChannels.length);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t))
    );
    setAllTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t))
    );
  };

  const handleApproveRequest = (id: string) => {
    setJoinRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleQuickDate = (chip: '2weeks' | '1month' | 'q4') => {
    const now = new Date();
    if (chip === '2weeks') {
      const d = new Date(now.getTime() + 14 * 86400000);
      setNewProjectTargetDate(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    } else if (chip === '1month') {
      const d = new Date(now.getTime() + 30 * 86400000);
      setNewProjectTargetDate(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      setNewProjectTargetDate('Nov 28, 2024 (Sprint End)');
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setProjectFormError('Project name is required.');
      return;
    }

    setProjectFormError(null);
    setIsSubmittingProject(true);

    const selectedPod = POD_OPTIONS.find((p) => p.id === newProjectPodId);

    const res = await createProjectInDb(
      {
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        targetDate: newProjectTargetDate.trim() || 'Nov 28, 2024 (Sprint End)',
        podId: newProjectPodId,
        pod: selectedPod?.name || 'Core Engineering',
      },
      currentUser
    );

    setIsSubmittingProject(false);

    if (!res.success || !res.project) {
      setProjectFormError(res.error || 'Failed to initialize project.');
      return;
    }

    // Prepend to project list
    setProjects((prev) => [res.project!, ...prev]);
    setShowNewProjectModal(false);
    setProjectSuccessNotice(
      `Project "${res.project.name}" initialized! Channel #${res.channel?.name || 'general'} created.`
    );
    setTimeout(() => setProjectSuccessNotice(null), 6000);

    // Reset inputs
    setNewProjectName('');
    setNewProjectDesc('');
  };

  const selectedPodInfo = POD_OPTIONS.find((p) => p.id === newProjectPodId) || POD_OPTIONS[0];

  // Computed dynamic stats for header and overview cards
  const todayLocaleStr = new Date().toDateString();
  const tasksDueToday = allTasks.filter((t) => {
    if (t.status === 'done') return false;
    if (!t.dueDate) return false;
    const d = t.dueDate.trim().toLowerCase();
    if (d === 'today') return true;
    const taskDate = new Date(t.dueDate);
    return !isNaN(taskDate.getTime()) && taskDate.toDateString() === todayLocaleStr;
  });
  const pendingDueTodayCount = tasksDueToday.length;
  const highPriorityDueTodayCount = tasksDueToday.filter((t) => t.priority === 'high').length;

  const openQuestionsCount = questions.filter((q) => !q.isAnswered).length;
  const solvedQuestionsCount = questions.filter((q) => q.isAnswered).length;

  const maxSeats = 30;
  const seatsPercentage = Math.round((activeSeatsCount / maxSeats) * 100);
  const completedTasksCount = allTasks.filter((t) => t.status === 'done').length;
  const totalTasksCount = allTasks.length;
  const sprintVelocityPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="flex flex-col w-full gap-6">
      {/* ============================================================ */}
      {/* 1. TOP GREETING & CONTEXT HEADER                             */}
      {/* ============================================================ */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
              Sprint 42 Active
            </span>
            <span className="text-[#3e4a3d] text-xs">•</span>
            <span className="text-[#3e4a3d] text-xs font-medium">Wednesday, Oct 25</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#131b2e] tracking-tight">
            Good morning, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-[#3e4a3d]">
            {currentUser.role === 'admin'
              ? `Workspace overview: ${activeSeatsCount} active seat${activeSeatsCount === 1 ? '' : 's'}, ${joinRequests.length} pending join request${joinRequests.length === 1 ? '' : 's'}, and system cluster normal.`
              : currentUser.role === 'lead'
              ? 'Welcome back. Team deliverables and standup pulses await your review.'
              : "Here is your team's pulse and your key priorities for today."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {currentUser.role === 'admin' && (
            <div className="flex items-center gap-1.5 bg-[#ffffff] px-3.5 py-2 rounded-xl border border-[#eaedff] shadow-xs text-xs font-medium text-[#131b2e]">
              <span className="material-symbols-outlined text-[#006b2c] text-[18px]">vpn_key</span>
              <span className="text-[#6e7b6c] hidden sm:inline">Pod Code:</span>
              <span className="font-mono font-bold text-[#006b2c]">{adminPodCode}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(adminPodCode);
                  setAdminPodCopied(true);
                  setTimeout(() => setAdminPodCopied(false), 2000);
                }}
                className="text-xs font-semibold text-[#131b2e] hover:text-[#006b2c] p-0.5 cursor-pointer ml-0.5"
                title="Copy pod invite code"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {adminPodCopied ? 'check' : 'content_copy'}
                </span>
              </button>
              <button
                onClick={() => onNavigate('manage-users')}
                className="text-[11px] font-semibold text-[#006b2c] hover:underline ml-1 cursor-pointer"
                title="Manage & Regenerate Pod Code"
              >
                Manage
              </button>
            </div>
          )}

          <div className="hidden sm:flex items-center bg-[#ffffff] px-3.5 py-2 rounded-xl border border-[#eaedff] shadow-xs text-xs font-medium text-[#131b2e]">
            <span className="material-symbols-outlined text-[#006b2c] text-[18px] mr-1.5">timer</span>
            <span>Sprint finishes in 4 days</span>
          </div>

          <button
            onClick={onQuickNewTask}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#006b2c] text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-[#00873a] transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_task</span>
            <span>Quick Add</span>
          </button>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. STAT SUMMARY CARDS (DYNAMIC PER ROLE)                     */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div
          onClick={() => onNavigate('tasks')}
          className="bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#006b2c]"></div>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">Priority Queue</span>
              <span className="text-sm font-semibold text-[#131b2e] mt-1">Tasks due today</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#eaedff] flex items-center justify-center text-[#006b2c] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#131b2e]">{pendingDueTodayCount}</span>
              <span className="text-xs text-[#6e7b6c]">pending</span>
            </div>
            <span className="text-[11px] font-semibold text-[#006b2c] bg-[#7ffc97]/30 px-2 py-0.5 rounded-full">
              {highPriorityDueTodayCount} high priority
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => onNavigate('questions')}
          className="bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">Knowledge Exchange</span>
              <span className="text-sm font-semibold text-[#131b2e] mt-1">Open questions</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#eaedff] flex items-center justify-center text-[#0051d5] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">help_center</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#131b2e]">{openQuestionsCount}</span>
              <span className="text-xs text-[#6e7b6c]">active</span>
            </div>
            <span className="text-[11px] font-semibold text-[#0051d5] bg-[#dbe1ff] px-2 py-0.5 rounded-full">
              {solvedQuestionsCount} solved
            </span>
          </div>
        </div>

        {/* Card 3: Sprint Progress or Admin Seats */}
        {currentUser.role === 'admin' ? (
          <div
            onClick={() => onNavigate('manage-users')}
            className="bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">Workspace Seats</span>
              <span className="material-symbols-outlined text-[20px] text-[#8d4b00]">group</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#131b2e]">{activeSeatsCount}</span>
                <span className="text-xs text-[#6e7b6c]">/ {maxSeats} seats</span>
              </div>
              <span className="text-[11px] font-semibold text-[#8d4b00] bg-[#ffdcc3] px-2 py-0.5 rounded-full">
                {seatsPercentage}% filled
              </span>
            </div>
            <div className="w-full bg-[#eaedff] h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#006b2c] h-full rounded-full" style={{ width: `${Math.min(100, seatsPercentage)}%` }}></div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onNavigate('tasks')}
            className="bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">Sprint Velocity</span>
              <span className="material-symbols-outlined text-[20px] text-[#006b2c]">speed</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#131b2e]">{sprintVelocityPct}%</span>
                <span className="text-xs text-[#6e7b6c]">{completedTasksCount} of {totalTasksCount} tasks</span>
              </div>
              <span className="text-[11px] font-semibold text-[#006b2c] bg-[#7ffc97]/30 px-2 py-0.5 rounded-full">
                {completedTasksCount} completed
              </span>
            </div>
            <div className="w-full bg-[#eaedff] h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#006b2c] h-full rounded-full" style={{ width: `${sprintVelocityPct}%` }}></div>
            </div>
          </div>
        )}

        {/* Card 4: AI Queue / Blockers */}
        <div
          onClick={onOpenAiDrawer}
          className="bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">AI Assistant</span>
            <div className="w-8 h-8 rounded-xl bg-[#7ffc97]/40 text-[#006b2c] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#131b2e]">{filesCount}</span>
              <span className="text-xs text-[#6e7b6c]">docs indexed</span>
            </div>
            <span className="text-[11px] font-semibold text-[#005320] bg-[#7ffc97] px-2 py-0.5 rounded-full">
              Live Index
            </span>
          </div>
          <span className="text-[11px] text-[#6e7b6c] mt-2">{channelsCount} channels & {filesCount} files ready</span>
        </div>
      </section>

      {/* Project Creation Success Banner */}
      {projectSuccessNotice && (
        <div className="p-3.5 rounded-xl bg-[#7ffc97]/30 border border-[#006b2c]/20 text-[#005320] text-xs font-semibold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#006b2c]">check_circle</span>
            <span>{projectSuccessNotice}</span>
          </div>
          <button
            onClick={() => setProjectSuccessNotice(null)}
            className="text-[#005320] hover:text-[#002109] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2.5 ACTIVE PROJECTS SECTION (STITCH DESIGN SPEC)             */}
      {/* ============================================================ */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#131b2e] tracking-tight">Active Projects</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-xs font-semibold">
                {projects.length} active
              </span>
            </div>
            <p className="text-xs text-[#3e4a3d]">Track milestones and cross-functional pod initiatives</p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs text-[#3e4a3d] hover:text-[#131b2e] underline font-medium transition-colors cursor-pointer"
            >
              View all ({projects.length})
            </button>
            {canCreateProject && (
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006b2c] text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-[#00873a] transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>New Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Projects Action Toast */}
        {projectActionToast && (
          <div className="p-3 rounded-xl bg-[#006b2c] text-white text-xs font-semibold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{projectActionToast}</span>
            </div>
            <button onClick={() => setProjectActionToast(null)} className="text-white/80 hover:text-white cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Projects Cards Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl bg-white border border-[#eaedff] flex flex-col items-center justify-center text-center text-xs text-[#6e7b6c]">
              <span className="material-symbols-outlined text-[36px] text-[#6e7b6c] mb-2">folder_off</span>
              <p className="font-semibold text-sm text-[#131b2e]">No active projects</p>
              <p className="text-[11px] mt-0.5">Projects created for your pod will appear here.</p>
            </div>
          ) : (
            projects.map((proj) => {
            // Live calculation from real tasks!
            const projectTasks = allTasks.filter((t) => t.projectId === proj.id);
            const totalDeliverables = projectTasks.length;
            const completedDeliverables = projectTasks.filter((t) => t.status === 'done').length;
            const percentage = totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0;
            const isAtRisk = proj.status === 'at_risk';
            const isCompleted = proj.status === 'completed' || (totalDeliverables > 0 && percentage === 100);

            // Member avatars mapping
            const avatars: User[] =
              proj.members && proj.members.length > 0
                ? proj.members
                : proj.id === 'proj-1'
                ? [USERS.david, USERS.anya, USERS.marcus, USERS.sarah, USERS.elena]
                : proj.id === 'proj-2'
                ? [USERS.elena, USERS.david, USERS.sarah]
                : proj.id === 'proj-3'
                ? [USERS.anya, USERS.david]
                : proj.id === 'proj-4'
                ? [USERS.marcus, USERS.elena, USERS.david]
                : [currentUser];

            const visibleAvatars = avatars.slice(0, 3);
            const remainingCount = avatars.length - visibleAvatars.length;

            return (
              <div
                key={proj.id}
                onClick={() => onNavigate('tasks', proj.id)}
                className={`bg-[#ffffff] p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group border border-[#eaedff] cursor-pointer relative ${
                  openProjectMenuId === proj.id ? 'z-30' : 'z-10'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-xs font-semibold">
                        <span className="material-symbols-outlined text-[13px] text-[#006b2c]">check_circle</span> Completed
                      </span>
                    ) : isAtRisk ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#6e3900] text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8d4b00]"></span> At Risk - {proj.statusDetail || 'Blocked on infra'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#7ffc97]/40 text-[#005320] text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span> On Track
                      </span>
                    )}

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenProjectMenuId(openProjectMenuId === proj.id ? null : proj.id);
                        }}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          openProjectMenuId === proj.id
                            ? 'bg-[#eaedff] text-[#006b2c]'
                            : 'text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff]'
                        }`}
                        title="Project options"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                      </button>

                      {openProjectMenuId === proj.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1 text-left"
                        >
                          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider border-b border-[#eaedff] mb-1">
                            Project Actions
                          </div>

                          <button
                            onClick={() => {
                              setOpenProjectMenuId(null);
                              onNavigate('tasks', proj.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#131b2e] hover:bg-[#f2f3ff] transition-colors text-left font-medium cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#006b2c]">check_circle</span>
                            <span>View Task Board</span>
                          </button>

                          <button
                            onClick={() => {
                              setOpenProjectMenuId(null);
                              onNavigate('channels');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#131b2e] hover:bg-[#f2f3ff] transition-colors text-left font-medium cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#0051d5]">forum</span>
                            <span>Open Channel</span>
                          </button>

                          <button
                            onClick={() => {
                              setOpenProjectMenuId(null);
                              onNavigate('files');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#131b2e] hover:bg-[#f2f3ff] transition-colors text-left font-medium cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#8d4b00]">folder</span>
                            <span>Files &amp; Specifications</span>
                          </button>

                          <div className="h-px bg-[#eaedff] my-1"></div>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`https://teamhub.internal/projects/${proj.id}`);
                              setOpenProjectMenuId(null);
                              setProjectActionToast(`Copied share link for "${proj.name}"!`);
                              setTimeout(() => setProjectActionToast(null), 3500);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e] transition-colors text-left font-medium cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">link</span>
                            <span>Copy Project Link</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base text-[#131b2e] font-semibold group-hover:text-[#006b2c] transition-colors leading-snug mb-1">
                    {proj.name}
                  </h3>

                  <div className="flex items-center gap-1.5 text-[#6e7b6c] text-xs mb-4">
                    <span className="material-symbols-outlined text-[14px]">
                      {isCompleted ? 'event_available' : 'calendar_today'}
                    </span>
                    <span>{proj.targetDate}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-3 border-t border-[#eaedff]">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#3e4a3d] font-medium">
                        {completedDeliverables} / {totalDeliverables} deliverables
                      </span>
                      <span className={`font-semibold ${isAtRisk ? 'text-[#8d4b00]' : 'text-[#006b2c]'}`}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#eaedff] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAtRisk ? 'bg-[#8d4b00]' : 'bg-[#006b2c]'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center -space-x-2">
                      {visibleAvatars.map((u) => (
                        <div
                          key={u.id}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-[#ffffff]"
                          style={{
                            backgroundColor: u.initialsColor ? `${u.initialsColor}25` : '#dbe1ff',
                            color: u.initialsColor || '#00174b',
                          }}
                          title={u.name}
                        >
                          {u.initials}
                        </div>
                      ))}
                      {remainingCount > 0 && (
                        <div className="w-7 h-7 rounded-full bg-[#eaedff] flex items-center justify-center text-[10px] text-[#3e4a3d] font-semibold ring-2 ring-[#ffffff]">
                          +{remainingCount}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-[#3e4a3d] font-medium group-hover:text-[#006b2c] flex items-center transition-colors">
                      View pod <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

          {/* Card 5: + New Project Action Card (Visible to Team Lead and Administrator) */}
          {canCreateProject && (
            <div
              onClick={() => setShowNewProjectModal(true)}
              className="bg-[#f2f3ff]/60 hover:bg-[#f2f3ff] border-2 border-dashed border-[#eaedff] hover:border-[#006b2c] p-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-full bg-[#eaedff] group-hover:bg-[#7ffc97]/40 flex items-center justify-center text-[#3e4a3d] group-hover:text-[#006b2c] transition-all mb-3 group-hover:scale-105">
                <span className="material-symbols-outlined text-[26px]">add</span>
              </div>
              <span className="text-base text-[#131b2e] font-semibold group-hover:text-[#006b2c] transition-colors mb-1">
                New Project
              </span>
              <p className="text-xs text-[#3e4a3d] max-w-[240px]">
                Create a shared space for deliverables &amp; sprint tracking
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. ADMIN SHORTCUTS OR LEAD REVIEW SECTION                     */}
      {/* ============================================================ */}
      {currentUser.role === 'admin' && (
        <section className="p-5 bg-[#ffffff] rounded-2xl shadow-xs border border-[#eaedff]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#8d4b00]">how_to_reg</span>
              <h2 className="text-base font-semibold text-[#131b2e]">Pending Join & Approval Requests</h2>
            </div>
            <button
              onClick={() => onNavigate('manage-users')}
              className="text-xs font-semibold text-[#006b2c] hover:underline cursor-pointer"
            >
              Manage Users View →
            </button>
          </div>

          <div className="space-y-3">
            {joinRequests.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-center text-xs text-[#6e7b6c]">
                <p className="font-semibold text-[#131b2e]">No pending join requests</p>
                <p className="text-[11px] mt-0.5">All new member registrations have been reviewed.</p>
              </div>
            ) : (
              joinRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-[#f2f3ff] flex items-center justify-between gap-4 border border-[#eaedff]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-xs flex items-center justify-center">
                    {req.avatarInitials}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#131b2e]">{req.name}</span>
                    <span className="text-[11px] text-[#6e7b6c] ml-2">{req.email}</span>
                    <div className="text-[11px] text-[#3e4a3d] mt-0.5">
                      Role: <strong>{req.role}</strong> • {req.department} • {req.requestedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveRequest(req.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#ffffff] hover:bg-[#eaedff] text-xs font-semibold text-[#ba1a1a] transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleApproveRequest(req.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-xs font-semibold text-white transition-colors cursor-pointer shadow-2xs"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
        </section>
      )}

      {currentUser.role === 'lead' && (
        <section className="p-5 bg-[#ffffff] rounded-2xl shadow-xs border border-[#eaedff]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#8d4b00]">rate_review</span>
              <h2 className="text-base font-semibold text-[#131b2e]">Deliverables Awaiting Your Review</h2>
            </div>
            <span className="text-xs text-[#6e7b6c] font-medium">3 tasks pending sign-off</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#f2f3ff] flex items-center justify-between border border-[#eaedff]">
              <div>
                <span className="text-xs font-bold text-[#131b2e] block">
                  Update color token values in design system v3.4
                </span>
                <span className="text-[11px] text-[#6e7b6c]">Marcus Reed • #design • Review state</span>
              </div>
              <button
                onClick={() => onNavigate('tasks', 'task-202')}
                className="px-3 py-1.5 rounded-lg bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all cursor-pointer"
              >
                Approve
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f2f3ff] flex items-center justify-between border border-[#eaedff]">
              <div>
                <span className="text-xs font-bold text-[#131b2e] block">
                  RFC-108: Event Fan-Out Architecture Spec
                </span>
                <span className="text-[11px] text-[#6e7b6c]">David Kim • #architecture • Pending feedback</span>
              </div>
              <button
                onClick={() => {
                  setUnblockedDavid(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0051d5] text-white text-xs font-semibold hover:bg-[#003ea8] transition-all cursor-pointer"
              >
                {unblockedDavid ? 'Unblocked ✓' : 'Review & Unblock'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 4. TWO-COLUMN WORKSTAGE: TODAY'S TASKS & OPEN QUESTIONS      */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Today's Tasks (7 cols) */}
        <div className="lg:col-span-7 bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#131b2e]">Today's Priorities</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-xs font-semibold">
                {tasks.length} items
              </span>
            </div>
            <button
              onClick={() => onNavigate('tasks')}
              className="inline-flex items-center gap-1 text-[#006b2c] hover:underline text-xs font-semibold cursor-pointer"
            >
              <span>View full board</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {tasks.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#faf8ff] border border-[#eaedff]/60 flex flex-col items-center justify-center text-center text-xs text-[#6e7b6c]">
                <span className="material-symbols-outlined text-[32px] text-[#006b2c] mb-2">task_alt</span>
                <p className="font-semibold text-[#131b2e]">No priority tasks for today</p>
                <p className="text-[11px] mt-0.5">You're all caught up on your active deliverables.</p>
              </div>
            ) : (
              tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onNavigate('tasks', task.id)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#faf8ff] hover:bg-[#f2f3ff] transition-colors cursor-pointer border border-[#eaedff]/60 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(task.id);
                    }}
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                      task.status === 'done' ? 'bg-[#006b2c] text-white' : 'bg-[#ffffff] border border-[#bdcaba]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[15px] ${
                        task.status === 'done' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                      }`}
                    >
                      check
                    </span>
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-xs font-semibold text-[#131b2e] truncate group-hover:text-[#006b2c] transition-colors ${
                        task.status === 'done' ? 'line-through opacity-50' : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-semibold text-[#006b2c]">{task.channel}</span>
                      <span className="text-[#bdcaba] text-[10px]">•</span>
                      <span className="text-[10px] text-[#6e7b6c] flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        {task.dueTime || task.dueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-2 ${
                    task.status === 'done'
                      ? 'bg-[#7ffc97]/40 text-[#005320]'
                      : task.status === 'in_progress'
                      ? 'bg-[#dbe1ff] text-[#00174b]'
                      : task.status === 'review'
                      ? 'bg-[#ffdcc3] text-[#2f1500]'
                      : 'bg-[#eaedff] text-[#3e4a3d]'
                  }`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))
          )}
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between text-xs text-[#6e7b6c] border-t border-[#eaedff]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>
              {tasks.filter((t) => t.status === 'done').length} of {tasks.length} items completed
            </span>
            <button
              onClick={onQuickNewTask}
              className="text-[#006b2c] hover:underline font-semibold cursor-pointer"
            >
              + Create task
            </button>
          </div>
        </div>

        {/* Right Column: Open Questions (5 cols) */}
        <div className="lg:col-span-5 bg-[#ffffff] p-5 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#eaedff]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#131b2e]">Open Questions</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-xs font-semibold">
                {questions.length} active
              </span>
            </div>
            <button
              onClick={() => onNavigate('questions')}
              className="text-[#006b2c] hover:underline text-xs font-semibold cursor-pointer"
            >
              Ask question
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {questions.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#faf8ff] text-center border border-[#eaedff]/60 flex flex-col items-center gap-1.5">
                <span className="material-symbols-outlined text-[24px] text-[#6e7b6c]">help_outline</span>
                <span className="text-xs font-medium text-[#131b2e]">No open questions</span>
                <span className="text-[11px] text-[#6e7b6c]">Your team has answered all pending technical questions.</span>
              </div>
            ) : (
              questions.slice(0, 3).map((q) => (
                <div
                  key={q.id}
                  onClick={() => onNavigate('questions', q.id)}
                  className="p-3.5 rounded-xl bg-[#faf8ff] hover:bg-[#f2f3ff] transition-all flex flex-col gap-1.5 cursor-pointer border border-[#eaedff]/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#eaedff] text-[#006b2c] text-[10px] font-bold flex items-center justify-center">
                        {q.author.initials}
                      </div>
                      <span className="text-xs font-semibold text-[#131b2e]">{q.author.name}</span>
                    </div>
                    <span className="text-[10px] text-[#6e7b6c]">in {q.channel}</span>
                  </div>
                  <p className="text-xs text-[#131b2e] font-medium line-clamp-2 leading-relaxed">
                    {q.title}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#6e7b6c]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eaedff] text-[#3e4a3d] font-semibold text-[10px]">
                      <span className="material-symbols-outlined text-[13px]">chat_bubble_outline</span>
                      {q.answers.length} replies
                    </span>
                    <span className="text-[#006b2c] font-semibold hover:underline">View answers →</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. TEAM STANDUP FEED GRID (Done / Doing / Blocked)           */}
      {/* ============================================================ */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-base font-semibold text-[#131b2e] tracking-tight">Team Standup Stream</h2>
            <p className="text-xs text-[#3e4a3d]">Daily async status from Core Engineering Pod</p>
          </div>
          <button
            onClick={() => onNavigate('my-work')}
            className="text-xs font-semibold text-[#006b2c] hover:underline self-start sm:self-auto cursor-pointer"
          >
            Post My Standup Update →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {standups.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl bg-white border border-[#eaedff] text-center text-xs text-[#6e7b6c] flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-[36px] text-[#6e7b6c] mb-2">stream</span>
              <p className="font-semibold text-sm text-[#131b2e]">No standup updates posted today</p>
              <p className="text-[11px] mt-0.5">Daily standup check-ins from pod members will appear here.</p>
            </div>
          ) : (
            standups.map((s) => (
            <div
              key={s.id}
              className="bg-[#ffffff] p-4 rounded-2xl shadow-xs border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#eaedff]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center shrink-0">
                      {s.user.initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[#131b2e] truncate">{s.user.name}</span>
                      <span className="text-[10px] text-[#6e7b6c] truncate">{s.user.roleTitle.split('•')[0]}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#6e7b6c]">{s.postedAt}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#006b2c] tracking-wider block">DONE</span>
                    <p className="text-[#3e4a3d] text-[11px] leading-relaxed mt-0.5">{s.done}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#0051d5] tracking-wider block">DOING</span>
                    <p className="text-[#3e4a3d] text-[11px] leading-relaxed mt-0.5">{s.doing}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8d4b00] tracking-wider block">BLOCKED</span>
                    <p
                      className={`text-[11px] leading-relaxed mt-0.5 ${
                        s.blocked.toLowerCase().includes('waiting') || s.blocked.toLowerCase().includes('block')
                          ? 'text-[#ba1a1a] font-semibold'
                          : 'text-[#006b2c] font-medium'
                      }`}
                    >
                      {s.blocked}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#eaedff] flex items-center justify-between text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                    s.status === 'blocked' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#7ffc97]/40 text-[#005320]'
                  }`}
                >
                  {s.status === 'blocked' ? 'Blocked' : 'On Track'}
                </span>
                <span className="text-[#6e7b6c] hover:text-[#131b2e] cursor-pointer">View notes</span>
              </div>
            </div>
          ))
        )}
        </div>
      </section>

      {/* Floating Ask AI Capsule */}
      <div className="fixed bottom-6 right-8 z-30 hidden sm:block">
        <button
          onClick={onOpenAiDrawer}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#006b2c] hover:bg-[#00873a] text-white font-semibold text-xs shadow-lg active:scale-95 transition-all cursor-pointer group"
        >
          <span className="material-symbols-outlined text-[19px] text-[#7ffc97] group-hover:rotate-12 transition-transform">
            auto_awesome
          </span>
          <span>Ask AI Assistant</span>
          <span className="px-1.5 py-0.5 rounded-md bg-[#7ffc97] text-[#002109] text-[10px] font-bold">
            ⌘J
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 6. NEW PROJECT MODAL DIALOG (STITCH DESIGN SPEC)             */}
      {/* ============================================================ */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-[#131b2e]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-200">
          <div
            aria-labelledby="modal-title"
            aria-modal="true"
            className="w-full max-w-[540px] bg-white rounded-[22px] shadow-2xl p-6 sm:p-7 relative flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
            role="dialog"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-[14px] bg-[#7ffc97]/40 flex items-center justify-center text-[#006b2c] shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[24px]">folder_special</span>
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-[#131b2e] tracking-tight" id="modal-title">
                    Create New Project
                  </h2>
                  <p className="text-sm text-[#3e4a3d] mt-0.5 leading-relaxed">
                    Set up a shared space for deliverables, sprint tracking, and async team feedback.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewProjectModal(false)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors shrink-0 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form Inputs Group */}
            <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-5">
              {projectFormError && (
                <div className="p-3 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{projectFormError}</span>
                </div>
              )}

              {/* Field 1: Project Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#131b2e] flex items-center gap-1" htmlFor="projectName">
                  <span>Project Name</span>
                  <span className="text-[#ba1a1a] font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    id="projectName"
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Q4 Design System Revamp or Mobile Onboarding 2.0"
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[#bdcaba] shadow-xs text-sm text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:border-[#006b2c] focus:ring-1 focus:ring-[#006b2c] transition-all"
                  />
                </div>
              </div>

              {/* Field 2: Description */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#131b2e] flex items-center gap-1.5" htmlFor="projectDesc">
                    <span>Description</span>
                    <span className="text-xs text-[#6e7b6c] font-normal">(Optional)</span>
                  </label>
                  <span className="text-xs text-[#6e7b6c] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">markdown</span> Supports markdown
                  </span>
                </div>
                <textarea
                  id="projectDesc"
                  rows={3}
                  maxLength={500}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Outline project goals, scope, and key milestones..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[#bdcaba] shadow-xs text-sm text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:border-[#006b2c] focus:ring-1 focus:ring-[#006b2c] resize-none transition-all"
                />
                <div className="flex justify-end">
                  <span className="text-[11px] text-[#6e7b6c]">
                    {newProjectDesc.length} / 500 characters
                  </span>
                </div>
              </div>

              {/* Field 3: Pod / Team Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#131b2e] flex items-center gap-1" htmlFor="teamPodSelect">
                  <span>Assigned Pod / Team</span>
                  <span className="text-[#ba1a1a] font-bold">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-[#006b2c]">
                    <span className="material-symbols-outlined text-[18px]">group_work</span>
                  </div>
                  <select
                    id="teamPodSelect"
                    value={newProjectPodId}
                    onChange={(e) => setNewProjectPodId(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-[12px] bg-white border border-[#bdcaba] shadow-xs text-sm text-[#131b2e] appearance-none focus:outline-none focus:border-[#006b2c] focus:ring-1 focus:ring-[#006b2c] cursor-pointer transition-all"
                  >
                    {POD_OPTIONS.map((pod) => (
                      <option key={pod.id} value={pod.id}>
                        {pod.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 flex items-center pointer-events-none text-[#6e7b6c]">
                    <span className="material-symbols-outlined text-[20px]">unfold_more</span>
                  </div>
                </div>
              </div>

              {/* Field 4: Target Completion Date */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#131b2e] flex items-center gap-1.5" htmlFor="targetDate">
                  <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">calendar_today</span>
                  <span>Target Completion Date</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="targetDate"
                    type="text"
                    value={newProjectTargetDate}
                    onChange={(e) => setNewProjectTargetDate(e.target.value)}
                    placeholder="Select target launch date"
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[#bdcaba] shadow-xs text-sm text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:border-[#006b2c] focus:ring-1 focus:ring-[#006b2c] transition-all cursor-pointer"
                  />
                  <span className="material-symbols-outlined absolute right-3.5 text-[#6e7b6c] text-[20px] pointer-events-none">
                    event
                  </span>
                </div>

                {/* Quick Select Date Chips */}
                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickDate('2weeks')}
                    className="px-2.5 py-1 rounded-full bg-[#eaedff] hover:bg-[#dbe1ff] text-[#131b2e] text-xs font-medium transition-colors cursor-pointer"
                  >
                    +2 Weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate('1month')}
                    className="px-2.5 py-1 rounded-full bg-[#eaedff] hover:bg-[#dbe1ff] text-[#131b2e] text-xs font-medium transition-colors cursor-pointer"
                  >
                    +1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate('q4')}
                    className="px-2.5 py-1 rounded-full bg-[#7ffc97] text-[#002109] text-xs font-semibold shadow-xs hover:bg-[#62df7d] transition-colors cursor-pointer"
                  >
                    End of Quarter (Q4)
                  </button>
                </div>
              </div>

              {/* Visibility / Scope Info Notice */}
              <div className="p-3.5 rounded-[12px] bg-[#f2f3ff] border border-[#eaedff] flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#006b2c] shrink-0 mt-0.5">visibility</span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#131b2e]">Workspace Visibility</span>
                  <span className="text-[11px] text-[#3e4a3d] mt-0.5 leading-normal">
                    Visible to all {selectedPodInfo.membersCount} members in {selectedPodInfo.name}. Guests require individual workspace invite.
                  </span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-[#eaedff] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 rounded-[12px] text-xs font-semibold text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProject}
                  className="px-5 py-2.5 rounded-[12px] bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] shadow-md flex items-center gap-2 transition-all transform active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmittingProject ? 'Creating...' : 'Create Project'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
