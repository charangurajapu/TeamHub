import React, { useState, useEffect, useMemo } from 'react';
import { Task, TaskStatus, User } from '../../types';
import { INITIAL_TASKS, USERS } from '../../data/mockData';
import { fetchTasksFromDb, createTaskInDb, updateTaskInDb, isSupabaseConfigured, getLocalProjects, getEligibleTaskAssignees } from '../../lib/supabase';
import { TaskDetailDrawer } from './TaskDetailDrawer';

interface TasksKanbanViewProps {
  currentUser: User;
  onOpenAiDrawer: () => void;
  selectedTaskId?: string;
}

export const TasksKanbanView: React.FC<TasksKanbanViewProps> = ({
  currentUser,
  onOpenAiDrawer,
  selectedTaskId,
}) => {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    selectedTaskId?.startsWith('proj-') ? selectedTaskId : null
  );
  const [activeTask, setActiveTask] = useState<Task | null>(
    INITIAL_TASKS.find((t) => t.id === selectedTaskId && !t.id.startsWith('proj-')) || null
  );
  const [viewType, setViewType] = useState<'board' | 'list'>('board');
  const [scope, setScope] = useState<'all' | 'my'>('all');
  const [memberFilter, setMemberFilter] = useState<string>('everyone');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [dbStatusNotice, setDbStatusNotice] = useState<string | null>(null);

  // Sync selected project or task when prop changes
  useEffect(() => {
    if (selectedTaskId) {
      if (selectedTaskId.startsWith('proj-')) {
        setSelectedProjectId(selectedTaskId);
      } else {
        const found = tasks.find(
          (t) => t.id === selectedTaskId || t.key.toLowerCase() === selectedTaskId.toLowerCase()
        );
        if (found) {
          setActiveTask(found);
        }
      }
    }
  }, [selectedTaskId, tasks]);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(selectedProjectId || '');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>(currentUser.id);

  // Sync newTaskProjectId whenever selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      setNewTaskProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Dynamically compute eligible assignees scoped by role:
  // - Lead: Only own pod members
  // - Admin: Only members of the chosen project (or all workspace members if no project)
  const eligibleAssignees = useMemo(() => {
    return getEligibleTaskAssignees(
      currentUser,
      newTaskProjectId || selectedProjectId || null,
      USERS,
      getLocalProjects()
    );
  }, [currentUser, newTaskProjectId, selectedProjectId]);

  // Keep newTaskAssignee valid when project/scope changes
  useEffect(() => {
    if (eligibleAssignees.length > 0) {
      const isCurrentValid = eligibleAssignees.some(
        (u) => u.id === newTaskAssignee || (USERS[newTaskAssignee] && USERS[newTaskAssignee].id === u.id)
      );
      if (!isCurrentValid) {
        setNewTaskAssignee(eligibleAssignees[0].id);
      }
    }
  }, [eligibleAssignees, newTaskAssignee]);

  const handleUpdateTask = async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setActiveTask(updated);

    if (isSupabaseConfigured) {
      const res = await updateTaskInDb(updated, currentUser);
      if (res.error) {
        setDbStatusNotice(`Supabase RLS Error: ${res.error}`);
      }
    }
  };

  const handleMoveTaskStatus = async (taskId: string, newStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
    setTasks(updatedTasks);
    const target = updatedTasks.find((t) => t.id === taskId);

    if (target && isSupabaseConfigured) {
      const res = await updateTaskInDb(target, currentUser);
      if (res.error) {
        setDbStatusNotice(`Supabase RLS Error: ${res.error}`);
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const allUsersList = Object.values(USERS);
    const assignedUser =
      eligibleAssignees.find((u) => u.id === newTaskAssignee) ||
      allUsersList.find((u) => u.id === newTaskAssignee) ||
      USERS[newTaskAssignee] ||
      currentUser;

    const effectiveProjectId = newTaskProjectId || selectedProjectId || undefined;

    const created: Task = {
      id: `task-${Date.now()}`,
      key: `#task-${Math.floor(100 + Math.random() * 900)}`,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Created during Sprint 42 sprint cycle.',
      status: 'todo',
      priority: newTaskPriority,
      channel: '#backend',
      sprint: 'Sprint 42',
      assignee: assignedUser,
      projectId: effectiveProjectId,
      dueDate: '2025-10-31',
      subtasks: [],
      attachments: [],
      comments: [],
    };

    let finalTask = created;

    if (isSupabaseConfigured) {
      const dbRes = await createTaskInDb(created, currentUser);
      if (dbRes.success && dbRes.task) {
        finalTask = dbRes.task;
        setDbStatusNotice(`Task "${finalTask.title}" created & persisted in Supabase database!`);
      } else if (dbRes.error) {
        setDbStatusNotice(`Supabase DB Error: ${dbRes.error}`);
      }
    }

    setTasks((prev) => [finalTask, ...prev]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowNewTaskModal(false);
    setShowEmptyState(false);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (selectedProjectId && t.projectId !== selectedProjectId) return false;
    if (scope === 'my' && t.assignee.id !== currentUser.id) return false;
    if (memberFilter !== 'everyone') {
      const u = USERS[memberFilter];
      if (u && t.assignee.id !== u.id) return false;
    }
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.channel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeProject = getLocalProjects().find((p) => p.id === selectedProjectId);

  const columns: Array<{ status: TaskStatus; label: string; dotColor: string; bgBadge: string; textBadge: string }> = [
    { status: 'todo', label: 'To Do', dotColor: 'bg-[#6e7b6c]', bgBadge: 'bg-[#eaedff]', textBadge: 'text-[#3e4a3d]' },
    { status: 'in_progress', label: 'In Progress', dotColor: 'bg-[#0051d5]', bgBadge: 'bg-[#dbe1ff]', textBadge: 'text-[#00174b]' },
    { status: 'review', label: 'Review', dotColor: 'bg-[#8d4b00]', bgBadge: 'bg-[#ffdcc3]', textBadge: 'text-[#2f1500]' },
    { status: 'done', label: 'Done', dotColor: 'bg-[#006b2c]', bgBadge: 'bg-[#7ffc97]', textBadge: 'text-[#002109]' },
  ];

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Scoped Project Banner if navigated from Project Card */}
      {selectedProjectId && (
        <div className="p-3.5 px-4 rounded-2xl bg-[#eaedff] border border-[#dbe1ff] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="w-8 h-8 rounded-xl bg-[#7ffc97]/40 text-[#006b2c] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">folder_special</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#131b2e]">Project Board:</span>
                <span className="text-[#006b2c] font-bold text-sm">{activeProject?.name || selectedProjectId}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#ffffff] text-[#005320] text-[10px] font-bold">
                  Scoped View
                </span>
              </div>
              <span className="text-[11px] text-[#6e7b6c]">
                {activeProject?.pod ? `${activeProject.pod} • ` : ''}Target: {activeProject?.targetDate || 'Nov 2024'} • {filteredTasks.length} deliverables
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedProjectId(null)}
            className="text-xs font-semibold text-[#006b2c] hover:underline px-3 py-1.5 rounded-xl bg-white border border-[#eaedff] cursor-pointer"
          >
            Show All Tasks
          </button>
        </div>
      )}

      {/* Board Meta & Header Bar */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs text-[#6e7b6c]">
              <span className="flex items-center gap-1.5 font-medium text-[#131b2e]">
                <span className="w-2 h-2 rounded-full bg-[#006b2c] inline-block"></span>
                Core Engineering Pod
              </span>
              <span>•</span>
              <span>Sprint 42 (Oct 23 – Nov 03)</span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7ffc97] text-[#005320]">
                Active Cycle
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-1">
              <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">Sprint 42 Board</h1>
              <span className="text-xs text-[#6e7b6c]">
                {filteredTasks.length} issues tracked across 4 workstreams
              </span>
            </div>
          </div>

          {/* Quick Metrics Pill */}
          <div className="flex items-center gap-4 bg-[#ffffff] p-2 pl-3 rounded-2xl shadow-xs border border-[#eaedff]">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[#131b2e]">Sprint Velocity</span>
                <span className="text-[#006b2c] font-bold">18 / 26 Done (69%)</span>
              </div>
              <div className="w-44 h-1.5 rounded-full bg-[#eaedff] mt-1 overflow-hidden">
                <div className="h-full bg-[#006b2c] rounded-full" style={{ width: '69%' }}></div>
              </div>
            </div>

            <div className="w-px h-8 bg-[#eaedff]"></div>

            <div className="flex -space-x-1.5 items-center">
              <span className="w-7 h-7 rounded-full bg-[#f2f3ff] flex items-center justify-center text-[10px] font-bold text-[#131b2e] ring-2 ring-white">
                DK
              </span>
              <span className="w-7 h-7 rounded-full bg-[#7ffc97] flex items-center justify-center text-[10px] font-bold text-[#002109] ring-2 ring-white">
                AL
              </span>
              <span className="w-7 h-7 rounded-full bg-[#ffdcc3] flex items-center justify-center text-[10px] font-bold text-[#2f1500] ring-2 ring-white">
                MR
              </span>
              <span className="w-7 h-7 rounded-full bg-[#eaedff] flex items-center justify-center text-[10px] font-bold text-[#3e4a3d] ring-2 ring-white">
                +4
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#ffffff] p-2.5 rounded-2xl shadow-xs border border-[#eaedff]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-[#f2f3ff]">
              <button
                onClick={() => setScope('my')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  scope === 'my' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#3e4a3d] hover:text-[#131b2e]'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  scope === 'all' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#3e4a3d] hover:text-[#131b2e]'
                }`}
              >
                All Tasks
              </button>
            </div>

            <div className="w-px h-6 bg-[#eaedff]"></div>

            {/* Member Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
              <button
                onClick={() => setMemberFilter('everyone')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  memberFilter === 'everyone'
                    ? 'bg-[#006b2c] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                Everyone
              </button>
              <button
                onClick={() => setMemberFilter('david')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  memberFilter === 'david'
                    ? 'bg-[#006b2c] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white text-[#131b2e] text-[9px] font-bold flex items-center justify-center">
                  DK
                </span>
                <span>David K.</span>
              </button>
              <button
                onClick={() => setMemberFilter('anya')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  memberFilter === 'anya'
                    ? 'bg-[#006b2c] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white text-[#131b2e] text-[9px] font-bold flex items-center justify-center">
                  AL
                </span>
                <span>Anya L.</span>
              </button>
              <button
                onClick={() => setMemberFilter('marcus')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  memberFilter === 'marcus'
                    ? 'bg-[#006b2c] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white text-[#131b2e] text-[9px] font-bold flex items-center justify-center">
                  MR
                </span>
                <span>Marcus R.</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Priority Filter Dropdown */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
              <span className="material-symbols-outlined text-[15px] text-[#6e7b6c]">filter_list</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-[#131b2e] focus:outline-none cursor-pointer"
                title="Filter visible cards by priority"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-2.5 text-[#6e7b6c] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tasks..."
                className="w-44 focus:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:bg-white border border-[#eaedff] transition-all"
              />
            </div>

            {/* View Switcher (Board vs List) */}
            <div className="flex items-center p-1 rounded-xl bg-[#f2f3ff]">
              <button
                onClick={() => setViewType('board')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewType === 'board' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
                }`}
                title="Board View"
              >
                <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewType === 'list' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
                }`}
                title="List View"
              >
                <span className="material-symbols-outlined text-[18px]">view_agenda</span>
              </button>
            </div>

            {/* Empty State Demo Toggle */}
            <button
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="p-1.5 rounded-xl text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
              title="Toggle Empty Board State"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showEmptyState ? 'visibility' : 'visibility_off'}
              </span>
            </button>

            {/* Create Task Button */}
            <button
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Task</span>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* EMPTY TASKS STATE DEMO (Screen 13)                           */}
      {/* ============================================================ */}
      {showEmptyState ? (
        <div className="relative w-full rounded-3xl bg-[#ffffff] p-8 sm:p-16 shadow-xs border border-[#eaedff] flex flex-col items-center justify-center text-center overflow-hidden">
          <div className="relative z-10 flex flex-col items-center max-w-md mx-auto">
            <div className="w-32 h-32 rounded-full bg-[#f2f3ff] flex items-center justify-center mb-6 shadow-inner">
              <span className="material-symbols-outlined text-[48px] text-[#006b2c]">task_alt</span>
            </div>
            <h2 className="text-xl font-bold text-[#131b2e] tracking-tight mb-2">
              No tasks on your plate
            </h2>
            <p className="text-xs text-[#6e7b6c] mb-8 leading-relaxed max-w-sm">
              You're all caught up on your assignments for this sprint. Feel free to draft a new deliverable or check what teammates are working on.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowEmptyState(false);
                  setShowNewTaskModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Create a task</span>
              </button>
              <button
                onClick={() => setShowEmptyState(false)}
                className="px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-[#131b2e] text-xs font-semibold hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                View all sprint issues
              </button>
            </div>
          </div>
        </div>
      ) : viewType === 'board' ? (
        /* ============================================================ */
        /* 4-COLUMN KANBAN BOARD                                        */
        /* ============================================================ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="flex flex-col bg-[#f2f3ff]/70 rounded-2xl p-3 border border-[#eaedff]">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1 py-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`}></span>
                    <h2 className="text-sm font-bold text-[#131b2e]">{col.label}</h2>
                    <span className={`px-2 py-0.2 rounded-full text-[11px] font-bold ${col.bgBadge} ${col.textBadge}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setShowNewTaskModal(true);
                    }}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                    title={`Add task to ${col.label}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>

                {/* Column Cards */}
                <div className="flex flex-col gap-3 min-h-[440px]">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setActiveTask(task)}
                      className={`group flex flex-col gap-2 p-4 rounded-xl bg-[#ffffff] border transition-all cursor-pointer active:scale-[0.99] ${
                        activeTask?.id === task.id
                          ? 'border-[#006b2c] shadow-md ring-2 ring-[#006b2c]/20'
                          : 'border-[#eaedff] shadow-xs hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              task.priority === 'high'
                                ? 'bg-[#ba1a1a]'
                                : task.priority === 'medium'
                                ? 'bg-[#8d4b00]'
                                : 'bg-[#0051d5]'
                            }`}
                            title={`${task.priority} Priority`}
                          ></span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f2f3ff] text-[#3e4a3d]">
                            {task.channel}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#6e7b6c]">{task.key}</span>
                      </div>

                      <h3 className="text-xs font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors line-clamp-2 leading-snug">
                        {task.title}
                      </h3>

                      {task.subtasks.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center justify-between text-[10px] text-[#6e7b6c]">
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px] text-[#006b2c]">
                                checklist
                              </span>
                              Checklist
                            </span>
                            <span className="font-semibold">
                              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-[#f2f3ff] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#006b2c] rounded-full"
                              style={{
                                width: `${(task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 mt-1 flex items-center justify-between border-t border-[#eaedff] text-xs">
                        <div className="flex items-center gap-1 text-[11px] text-[#6e7b6c]">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span className={task.dueTime ? 'text-[#ba1a1a] font-semibold' : ''}>
                            {task.dueTime || task.dueDate}
                          </span>
                        </div>

                        {/* Assignee Monogram & Move Status Pill */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-[#eaedff] text-[#006b2c] text-[10px] font-bold flex items-center justify-center">
                            {task.assignee.initials}
                          </div>

                          {/* Quick move menu button */}
                          <div className="relative group/opt">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextCol: Record<TaskStatus, TaskStatus> = {
                                  todo: 'in_progress',
                                  in_progress: 'review',
                                  review: 'done',
                                  done: 'todo',
                                };
                                handleMoveTaskStatus(task.id, nextCol[task.status], e);
                              }}
                              className="w-5 h-5 rounded-md hover:bg-[#eaedff] flex items-center justify-center text-[#6e7b6c] hover:text-[#006b2c]"
                              title="Advance Status"
                            >
                              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[#eaedff] rounded-xl text-xs text-[#6e7b6c]">
                      <span>No tasks in {col.label}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ============================================================ */
        /* LIST VIEW                                                    */
        /* ============================================================ */
        <div className="bg-[#ffffff] rounded-2xl shadow-xs border border-[#eaedff] overflow-hidden">
          <div className="divide-y divide-[#eaedff]">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setActiveTask(task)}
                className="p-4 flex items-center justify-between gap-4 hover:bg-[#f2f3ff] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      task.priority === 'high' ? 'bg-[#ba1a1a]' : task.priority === 'medium' ? 'bg-[#8d4b00]' : 'bg-[#0051d5]'
                    }`}
                  ></span>
                  <span className="text-xs font-bold text-[#006b2c] shrink-0">{task.key}</span>
                  <span className="text-xs font-semibold text-[#131b2e] truncate group-hover:text-[#006b2c] transition-colors">
                    {task.title}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f2f3ff] text-[#3e4a3d] shrink-0 hidden sm:inline">
                    {task.channel}
                  </span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[#6e7b6c] hidden md:inline">
                    {task.dueTime || task.dueDate}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      task.status === 'done'
                        ? 'bg-[#7ffc97] text-[#005320]'
                        : task.status === 'in_progress'
                        ? 'bg-[#dbe1ff] text-[#00174b]'
                        : task.status === 'review'
                        ? 'bg-[#ffdcc3] text-[#2f1500]'
                        : 'bg-[#eaedff] text-[#3e4a3d]'
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-[#eaedff] text-[#006b2c] text-[10px] font-bold flex items-center justify-center">
                    {task.assignee.initials}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slide-out Task Details Drawer */}
      <TaskDetailDrawer
        task={activeTask}
        currentUser={currentUser}
        projects={getLocalProjects()}
        allUsers={USERS}
        onClose={() => setActiveTask(null)}
        onUpdateTask={handleUpdateTask}
        onOpenAiDrawer={onOpenAiDrawer}
      />

      {/* + New Task Modal Dialog */}
      {showNewTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#131b2e]/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowNewTaskModal(false)}
        >
          <div
            className="bg-[#ffffff] w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-[#eaedff]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#eaedff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006b2c] text-[22px]">add_task</span>
                <h3 className="text-base font-bold text-[#131b2e]">Create Task in Sprint 42</h3>
              </div>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#131b2e] mb-1">Task Title *</label>
                <input
                  required
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Audit telemetry event pipeline"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#131b2e] mb-1">Description</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Acceptance criteria, context, or links..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white resize-none"
                />
              </div>

              {/* Project Selector for Administrator */}
              {currentUser.role === 'admin' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-[#131b2e]">Project Scope</label>
                    <span className="text-[10px] text-[#6e7b6c]">Assignees will scope to this project</span>
                  </div>
                  <select
                    value={newTaskProjectId}
                    onChange={(e) => setNewTaskProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none"
                  >
                    <option value="">-- No Project (Workspace Wide) --</option>
                    {getLocalProjects().map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.pod})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pod Banner for Team Lead */}
              {currentUser.role === 'lead' && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#eaedff] text-[#0051d5] text-[11px] font-medium border border-[#dbe1ff]">
                  <span className="material-symbols-outlined text-[16px]">groups</span>
                  <span>
                    Scoped to your pod: <strong>{currentUser.pod || 'Own Pod'}</strong> ({eligibleAssignees.length} members eligible)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-[#131b2e]">Assignee</label>
                    <span className="text-[10px] text-[#6e7b6c]">
                      {currentUser.role === 'lead'
                        ? 'Pod only'
                        : newTaskProjectId
                        ? `Project (${eligibleAssignees.length})`
                        : `All (${eligibleAssignees.length})`}
                    </span>
                  </div>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none"
                  >
                    {eligibleAssignees.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.roleTitle || user.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="w-full px-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e7b6c] hover:bg-[#eaedff] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
