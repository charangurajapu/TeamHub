import React, { useState, useEffect } from 'react';
import { User, ViewMode, Task, StandupEntry, WorkspaceFile } from '../../types';
import { fetchTasksFromDb, fetchStandupsFromDb, fetchWorkspaceFilesFromDb } from '../../lib/supabase';

interface MyWorkViewProps {
  currentUser: User;
  onNavigate: (view: ViewMode, itemId?: string) => void;
  onOpenPhotoModal: () => void;
}

export const MyWorkView: React.FC<MyWorkViewProps> = ({
  currentUser,
  onNavigate,
  onOpenPhotoModal,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userFiles, setUserFiles] = useState<WorkspaceFile[]>([]);
  const [doneText, setDoneText] = useState<string>('');
  const [doingText, setDoingText] = useState<string>('');
  const [blockedText, setBlockedText] = useState<string>('');
  const [publishedToast, setPublishedToast] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      try {
        const [allTasks, allStandups, allFiles] = await Promise.all([
          fetchTasksFromDb(),
          fetchStandupsFromDb(),
          fetchWorkspaceFilesFromDb(),
        ]);

        if (!isMounted) return;

        // Scoped to current user (by id or email)
        const myTasks = (allTasks || []).filter(
          (t) =>
            t.assignee?.id === currentUser.id ||
            t.assignee?.email === currentUser.email ||
            (t as any).assignee_id === currentUser.id
        );
        setTasks(myTasks);

        const myFiles = (allFiles || []).filter(
          (f) =>
            f.uploader?.id === currentUser.id ||
            f.uploader?.email === currentUser.email
        );
        setUserFiles(myFiles);

        // Find existing standup entry for currentUser
        const myStandup = (allStandups || []).find(
          (s) =>
            s.user?.id === currentUser.id ||
            s.user?.email === currentUser.email
        );

        if (myStandup) {
          setDoneText(myStandup.done || '');
          setDoingText(myStandup.doing || '');
          setBlockedText(myStandup.blocked || '');
        } else if (myTasks.length > 0) {
          // Derive draft standup from user's actual tasks in database
          const doneList = myTasks.filter((t) => t.status === 'done').map((t) => t.title);
          const doingList = myTasks.filter((t) => t.status === 'in_progress').map((t) => t.title);
          const reviewList = myTasks.filter((t) => t.status === 'review').map((t) => t.title);

          setDoneText(doneList.length > 0 ? doneList.join('; ') : '');
          setDoingText(doingList.length > 0 ? doingList.join('; ') : '');
          setBlockedText(reviewList.length > 0 ? `In review: ${reviewList.join(', ')}` : '');
        } else {
          setDoneText('');
          setDoingText('');
          setBlockedText('');
        }
      } catch (err) {
        console.warn('Failed to load user work data:', err);
      }
    }

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handlePublishUpdate = () => {
    setPublishedToast(true);
    setTimeout(() => setPublishedToast(false), 2500);
  };

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const completedCount = completedTasks.length;
  const totalCount = tasks.length;
  const pacePercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col w-full gap-6">
      {/* TOP PROFILE & WEEKLY VELOCITY HEADER */}
      <div className="bg-[#ffffff] rounded-2xl p-6 shadow-xs border border-[#eaedff] flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[#ffdcc3] text-[#2f1500] flex items-center justify-center text-xl font-bold shadow-xs">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.initials
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#006b2c] ring-2 ring-white"></span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#131b2e] tracking-tight">
                  {currentUser.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eaedff] text-[#3e4a3d]">
                  {currentUser.pod}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7ffc97] text-[#005320] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                  Focus mode • Back at 2 PM
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6e7b6c]">
                <span className="font-semibold text-[#131b2e]">{currentUser.roleTitle}</span>
                <span>•</span>
                <span>{currentUser.timezone}</span>
                <span>•</span>
                <span>{currentUser.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenPhotoModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">edit</span>
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Weekly Goal & Velocity Banner */}
        <div className="bg-[#f2f3ff] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 border border-[#eaedff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#7ffc97] flex items-center justify-center text-[#006b2c]">
                <span className="material-symbols-outlined text-[18px]">speed</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#131b2e]">Weekly Goal &amp; Velocity</h2>
                <span className="text-[11px] text-[#6e7b6c]">
                  Sprint Deliverables: {completedCount} of {totalCount} completed
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-[#006b2c] flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                {pacePercentage}% pace
              </span>
              <span>•</span>
              <span className="text-[#6e7b6c]">Active Sprint</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#131b2e]">
                {completedCount} of {totalCount} tasks completed
              </span>
              <span className="font-bold text-[#006b2c]">{pacePercentage}% pace</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#eaedff] overflow-hidden">
              <div
                className="h-full bg-[#006b2c] rounded-full transition-all duration-700"
                style={{ width: `${pacePercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN WORKSTREAM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Today's Standup & Active Tasks (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* SECTION A: 3-BLOCK STANDUP POST CARD */}
          <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#7ffc97] flex items-center justify-center text-[#006b2c]">
                  <span className="material-symbols-outlined text-[18px]">send_time_extension</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#131b2e]">Post Today's Update</h3>
                  <p className="text-[11px] text-[#6e7b6c]">Drafting for {currentUser.pod} daily async sync</p>
                </div>
              </div>
              <span className="text-[11px] text-[#6e7b6c]">Today</span>
            </div>

            <div className="space-y-3">
              {/* DONE */}
              <div className="bg-[#f2f3ff] rounded-xl p-3 flex flex-col gap-1.5 border border-[#eaedff]">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#006b2c] text-white w-fit">
                  DONE
                </span>
                <textarea
                  rows={2}
                  value={doneText}
                  placeholder="What deliverables did you complete?"
                  onChange={(e) => setDoneText(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[#ffffff] text-xs text-[#131b2e] border border-[#eaedff] focus:outline-none resize-none"
                />
              </div>

              {/* DOING */}
              <div className="bg-[#f2f3ff] rounded-xl p-3 flex flex-col gap-1.5 border border-[#eaedff]">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0051d5] text-white w-fit">
                  DOING
                </span>
                <textarea
                  rows={2}
                  value={doingText}
                  placeholder="What are you working on today?"
                  onChange={(e) => setDoingText(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[#ffffff] text-xs text-[#131b2e] border border-[#eaedff] focus:outline-none resize-none"
                />
              </div>

              {/* BLOCKED */}
              <div className="bg-[#f2f3ff] rounded-xl p-3 flex flex-col gap-1.5 border border-[#eaedff]">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#ffdad6] text-[#ba1a1a] w-fit">
                  BLOCKED
                </span>
                <textarea
                  rows={2}
                  value={blockedText}
                  placeholder="Any blockers or items needing review? (Optional)"
                  onChange={(e) => setBlockedText(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[#ffffff] text-xs text-[#131b2e] border border-[#eaedff] focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#006b2c] font-semibold bg-[#eaedff] px-2 py-0.5 rounded">
                  #{currentUser.department?.toLowerCase() || 'general'}
                </span>
                <span className="text-[10px] text-[#006b2c] font-semibold bg-[#eaedff] px-2 py-0.5 rounded">
                  #daily-standup
                </span>
              </div>

              <button
                onClick={handlePublishUpdate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">send</span>
                <span>Publish Update</span>
              </button>
            </div>

            {publishedToast && (
              <div className="p-2.5 rounded-xl bg-[#006b2c] text-white text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Update posted to pod daily standup stream!</span>
              </div>
            )}
          </div>

          {/* Active Tasks & Assignments */}
          <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <span className="text-sm font-bold text-[#131b2e]">Active Tasks &amp; Assignments</span>
              <span className="text-xs text-[#6e7b6c]">{activeTasks.length} in progress</span>
            </div>

            <div className="space-y-2">
              {activeTasks.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-center text-xs text-[#6e7b6c]">
                  <p className="font-semibold text-[#131b2e]">No active tasks</p>
                  <p className="text-[11px] mt-0.5">Tasks assigned to you in Supabase will appear here.</p>
                </div>
              ) : (
                activeTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigate('tasks', t.id)}
                    className="p-3.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] transition-colors cursor-pointer border border-[#eaedff] flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#131b2e] truncate">{t.title}</span>
                      <span className="text-[11px] text-[#6e7b6c] mt-0.5">{t.description || t.channel}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#006b2c] shrink-0">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Docs (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Completed Deliverables Timeline */}
          <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <span className="text-sm font-bold text-[#131b2e]">Completed Deliverables</span>
              <span className="text-xs font-bold text-[#006b2c] bg-[#7ffc97]/40 px-2 py-0.5 rounded-full">
                {completedTasks.length} Done
              </span>
            </div>

            {completedTasks.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-center text-xs text-[#6e7b6c]">
                <p className="font-semibold text-[#131b2e]">No completed deliverables yet</p>
                <p className="text-[11px] mt-0.5">Finished tasks will be cataloged in your sprint timeline.</p>
              </div>
            ) : (
              <div className="relative pl-5 flex flex-col gap-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#eaedff]">
                {completedTasks.map((t) => (
                  <div key={t.id} className="relative">
                    <span className="absolute -left-5 top-0.5 w-4 h-4 rounded-full bg-[#006b2c] text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                    <span className="text-[10px] text-[#6e7b6c] uppercase font-bold">
                      {t.dueDate || 'Completed'} • {t.channel}
                    </span>
                    <h4 className="text-xs font-bold text-[#131b2e] mt-0.5">{t.title}</h4>
                    {t.description && (
                      <p className="text-[11px] text-[#3e4a3d]">{t.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Authored Specs */}
          <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3">
            <span className="text-sm font-bold text-[#131b2e]">Authored Files &amp; Specs</span>
            <div className="space-y-2">
              {userFiles.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#f2f3ff] text-center text-xs text-[#6e7b6c]">
                  No authored files yet
                </div>
              ) : (
                userFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onNavigate('files')}
                    className="p-3 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="material-symbols-outlined text-[#006b2c] text-[20px]">
                        {file.type === 'pdf' ? 'picture_as_pdf' : file.type === 'md' ? 'description' : 'image'}
                      </span>
                      <span className="text-xs font-bold text-[#131b2e] truncate">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-[#6e7b6c] shrink-0">{file.size}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
