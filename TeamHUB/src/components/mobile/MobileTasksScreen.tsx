import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { INITIAL_TASKS } from '../../data/mockData';

interface MobileTasksScreenProps {
  onSelectTask: (task: Task) => void;
  onNewTask: () => void;
}

export const MobileTasksScreen: React.FC<MobileTasksScreenProps> = ({
  onSelectTask,
  onNewTask,
}) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'todo' | 'in_progress' | 'review' | 'done'>('all');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const toggleTaskStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus: TaskStatus = t.status === 'done' ? 'todo' : 'done';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'today') return t.dueDate.includes('25') || t.dueTime;
    return t.status === filter;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#faf8ff] pb-24 text-[#131b2e]">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 w-full bg-[#faf8ff]/85 backdrop-blur-xl shadow-xs px-4 py-3 flex items-center justify-between border-b border-[#eaedff]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#131b2e]">Tasks</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#eaedff] text-[#006b2c] font-semibold">
            Sprint 42
          </span>
        </div>
        <button
          onClick={onNewTask}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#006b2c] text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Add Task</span>
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#eaedff] bg-[#ffffff]">
        {(['all', 'today', 'todo', 'in_progress', 'review', 'done'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize shrink-0 transition-all cursor-pointer ${
              filter === tab ? 'bg-[#006b2c] text-white shadow-xs' : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="p-4 space-y-2.5">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onSelectTask(task)}
            className="p-3.5 rounded-2xl bg-[#ffffff] border border-[#eaedff]/70 shadow-xs flex items-start gap-3 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <button
              onClick={(e) => toggleTaskStatus(task.id, e)}
              className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                task.status === 'done' ? 'bg-[#006b2c] text-white' : 'bg-[#f2f3ff] text-[#3e4a3d]'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  task.status === 'done' ? 'opacity-100' : 'opacity-0'
                }`}
              >
                check
              </span>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`text-xs font-bold truncate text-[#131b2e] ${
                    task.status === 'done' ? 'line-through opacity-50' : ''
                  }`}
                >
                  {task.title}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    task.priority === 'high'
                      ? 'bg-[#ffdad6] text-[#ba1a1a]'
                      : task.priority === 'medium'
                      ? 'bg-[#ffdcc3] text-[#8d4b00]'
                      : 'bg-[#eaedff] text-[#0051d5]'
                  }`}
                >
                  {task.priority}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#6e7b6c] mt-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#006b2c]">{task.channel}</span>
                  {task.subtasks.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[13px]">checklist</span>
                      {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#6e7b6c]">
                    {task.dueTime || task.dueDate}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-[#eaedff] text-[#006b2c] text-[9px] font-bold flex items-center justify-center">
                    {task.assignee.initials}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
