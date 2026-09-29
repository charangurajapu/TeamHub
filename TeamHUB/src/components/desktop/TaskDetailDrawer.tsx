import React, { useState } from 'react';
import { Task, TaskStatus, Subtask } from '../../types';

interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
  onUpdateTask: (updated: Task) => void;
  onOpenAiDrawer: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  onClose,
  onUpdateTask,
  onOpenAiDrawer,
}) => {
  if (!task) return null;

  const [commentInput, setCommentInput] = useState('');
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const toggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    const newSt: Subtask = {
      id: `st-${Date.now()}`,
      title: newSubtaskInput.trim(),
      completed: false,
    };
    onUpdateTask({ ...task, subtasks: [...task.subtasks, newSt] });
    setNewSubtaskInput('');
    setIsAddingSubtask(false);
  };

  const handleAiSuggestSubtasks = () => {
    setIsAiSuggesting(true);
    setTimeout(() => {
      const generated: Subtask[] = [
        { id: `st-ai-1`, title: 'Audit HTTP 401 refresh token race conditions', completed: false },
        { id: `st-ai-2`, title: 'Verify standby redis proxy TTL skew buffer tolerance', completed: false },
      ];
      onUpdateTask({ ...task, subtasks: [...task.subtasks, ...generated] });
      setIsAiSuggesting(false);
    }, 600);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const newComment = {
      id: `comm-${Date.now()}`,
      authorId: 'user-current',
      authorName: 'Sarah Connor',
      authorInitials: 'SC',
      createdAt: 'Just now',
      content: commentInput.trim(),
    };

    onUpdateTask({
      ...task,
      comments: [...task.comments, newComment],
    });
    setCommentInput('');
  };

  const handleDownloadAttachment = (filename: string) => {
    const textContent = `TeamHUB Attachment Spec Document\n----------------------------------------\nFilename: ${filename}\nTask Reference: ${task.key}\nTitle: ${task.title}\nStatus: ${task.status}\nAssignee: ${task.assignee.name}\nSprint: ${task.sprint}`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const completedCount = task.subtasks.filter((s) => s.completed).length;
  const totalCount = task.subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#131b2e]/25 backdrop-blur-[2px] transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[540px] h-full bg-[#ffffff] shadow-2xl border-l border-[#eaedff] flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navigation & Controls Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#eaedff] bg-[#ffffff]/90 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xs text-[#6e7b6c]">
            <span className="hover:text-[#131b2e] cursor-pointer">Sprint 42</span>
            <span>/</span>
            <span className="hover:text-[#131b2e] cursor-pointer">Core Engineering</span>
            <span>/</span>
            <span className="font-semibold text-[#006b2c] px-2 py-0.5 rounded-md bg-[#7ffc97]/30">
              {task.key}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
              title="Copy link to task"
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors ml-1 cursor-pointer"
              title="Close drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Title & Status Pills */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dbe1ff] text-[#00174b] text-xs font-semibold capitalize">
                <span className="w-2 h-2 rounded-full bg-[#0051d5]"></span>
                <span>{task.status.replace('_', ' ')}</span>
              </div>

              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  task.priority === 'high'
                    ? 'bg-[#ffdad6] text-[#ba1a1a]'
                    : task.priority === 'medium'
                    ? 'bg-[#ffdcc3] text-[#8d4b00]'
                    : 'bg-[#eaedff] text-[#3e4a3d]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                <span className="capitalize">{task.priority} Priority</span>
              </div>
            </div>

            <h1 className="text-xl font-bold text-[#131b2e] tracking-tight leading-snug">
              {task.title}
            </h1>
          </div>

          {/* Key Properties Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#f2f3ff] border border-[#eaedff]">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6e7b6c]">Assignee</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-6 h-6 rounded-full bg-[#7ffc97] text-[#002109] font-bold text-[10px] flex items-center justify-center">
                  {task.assignee.initials}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#131b2e]">{task.assignee.name}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#ffffff] text-[#6e7b6c]">
                    {task.assignee.department.split(' ')[0]}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6e7b6c]">Due Date</span>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-[#ba1a1a]">
                <span className="material-symbols-outlined text-[16px]">alarm</span>
                <span>{task.dueTime ? `${task.dueDate} • ${task.dueTime}` : task.dueDate}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-2 border-t border-[#eaedff]">
              <span className="text-[11px] text-[#6e7b6c]">Sprint</span>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#131b2e] font-medium">
                <span className="material-symbols-outlined text-[15px] text-[#006b2c]">sync</span>
                <span>{task.sprint}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-2 border-t border-[#eaedff]">
              <span className="text-[11px] text-[#6e7b6c]">Channel & Tags</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaedff] text-[#006b2c]">
                  {task.channel}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[#131b2e]">Description</span>
            <p className="text-xs text-[#3e4a3d] bg-[#f2f3ff]/60 p-3.5 rounded-xl border border-[#eaedff] leading-relaxed">
              {task.description}
            </p>
          </div>

          {/* Subtasks Section with AI Suggester */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#131b2e]">Subtasks Checklist</span>
                <span className="text-xs text-[#6e7b6c]">
                  ({completedCount}/{totalCount} completed)
                </span>
              </div>

              <button
                onClick={handleAiSuggestSubtasks}
                disabled={isAiSuggesting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#7ffc97]/40 text-[#005320] hover:bg-[#7ffc97] text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isAiSuggesting ? 'refresh' : 'auto_awesome'}
                </span>
                <span>{isAiSuggesting ? 'Generating...' : 'Suggest with AI'}</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-[#eaedff] overflow-hidden">
              <div
                className="h-full bg-[#006b2c] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5">
              {task.subtasks.map((st) => (
                <label
                  key={st.id}
                  onClick={() => toggleSubtask(st.id)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-[#006b2c] accent-[#006b2c] h-4 w-4 cursor-pointer"
                  />
                  <span
                    className={`text-xs text-[#131b2e] leading-snug select-none ${
                      st.completed ? 'line-through text-[#6e7b6c]' : ''
                    }`}
                  >
                    {st.title}
                  </span>
                </label>
              ))}

              {isAddingSubtask ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    autoFocus
                    type="text"
                    value={newSubtaskInput}
                    onChange={(e) => setNewSubtaskInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="New subtask title..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#eaedff] bg-[#f2f3ff] focus:outline-none focus:bg-white"
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="px-3 py-1.5 bg-[#006b2c] text-white text-xs font-semibold rounded-lg"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setIsAddingSubtask(false)}
                    className="text-xs text-[#6e7b6c]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingSubtask(true)}
                  className="flex items-center gap-1.5 text-xs text-[#006b2c] font-semibold hover:underline p-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add subtask</span>
                </button>
              )}
            </div>
          </div>

          {/* Attached Files */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#eaedff]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#131b2e]">Attached Files (2)</span>
              <button
                onClick={() => handleDownloadAttachment('auth-sequence.png')}
                className="text-[11px] text-[#006b2c] font-semibold hover:underline cursor-pointer"
              >
                Upload
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div
                onClick={() => handleDownloadAttachment('auth-sequence.png')}
                className="flex items-center justify-between p-2.5 rounded-xl border border-[#eaedff] bg-[#faf8ff] hover:bg-[#f2f3ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#006b2c] shrink-0">
                    <span className="material-symbols-outlined text-[18px]">image</span>
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-medium text-[#131b2e] truncate">auth-sequence.png</span>
                    <span className="text-[10px] text-[#6e7b6c]">1.4 MB</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">download</span>
              </div>

              <div
                onClick={() => handleDownloadAttachment('redis-spec.pdf')}
                className="flex items-center justify-between p-2.5 rounded-xl border border-[#eaedff] bg-[#faf8ff] hover:bg-[#f2f3ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a] shrink-0">
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-medium text-[#131b2e] truncate">redis-spec.pdf</span>
                    <span className="text-[10px] text-[#6e7b6c]">480 KB</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">download</span>
              </div>
            </div>
          </div>

          {/* Activity & Comments */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#eaedff]">
            <span className="text-xs font-bold text-[#131b2e]">Activity Timeline</span>
            <div className="space-y-2.5">
              {task.comments.map((comm) => (
                <div key={comm.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#dbe1ff] text-[#00174b] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {comm.authorInitials}
                  </div>
                  <div className="flex-1 bg-[#f2f3ff] p-3 rounded-xl text-xs border border-[#eaedff]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#131b2e]">{comm.authorName}</span>
                      <span className="text-[10px] text-[#6e7b6c]">{comm.createdAt}</span>
                    </div>
                    <p className="text-[#3e4a3d] leading-relaxed">{comm.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Comment Composer */}
        <div className="p-4 border-t border-[#eaedff] bg-[#ffffff] shrink-0">
          <form onSubmit={handleAddComment} className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write a comment or mention @teammate..."
                className="w-full pl-3 pr-20 py-2 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] border border-[#eaedff] focus:outline-none focus:bg-white"
              />
              <div className="absolute right-2 flex items-center gap-1 text-[#6e7b6c]">
                <button type="button" className="p-1 hover:text-[#131b2e]">
                  <span className="material-symbols-outlined text-[17px]">alternate_email</span>
                </button>
                <button type="button" className="p-1 hover:text-[#131b2e]">
                  <span className="material-symbols-outlined text-[17px]">attach_file</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] text-[#6e7b6c] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#006b2c]">lock_open</span>
                <span>Visible to pod members</span>
              </span>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                Comment
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
