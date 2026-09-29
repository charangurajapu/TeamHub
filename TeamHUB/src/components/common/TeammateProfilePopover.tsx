import React from 'react';
import { User } from '../../types';

interface TeammateProfilePopoverProps {
  user: User;
  onClose: () => void;
  onDirectMessage: (user: User) => void;
  onViewTasks: (user: User) => void;
}

export const TeammateProfilePopover: React.FC<TeammateProfilePopoverProps> = ({
  user,
  onClose,
  onDirectMessage,
  onViewTasks,
}) => {
  return (
    <div
      className="absolute left-10 top-12 z-50 w-[400px] max-w-[calc(100vw-320px)] bg-[#ffffff] rounded-2xl shadow-2xl border border-[#eaedff] p-5 transition-all duration-200 animate-in fade-in zoom-in-95"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Utility Row: Pod Chip & Close Action */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaedff] text-[11px] font-semibold text-[#3e4a3d]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
          <span>{user.pod || 'Core Systems Pod'}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
          title="Close card"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Identity Section: Avatar & Primary Metadata */}
      <div className="flex items-start gap-4 pb-4">
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm bg-[#eaedff]">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-lg text-[#006b2c]">
                {user.initials}
              </div>
            )}
          </div>
          {/* Live Presence Dot */}
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#006b2c] ring-2 ring-[#ffffff] flex items-center justify-center shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg text-[#131b2e] font-semibold truncate">{user.name}</h3>
            <span
              className="material-symbols-outlined text-[18px] text-[#006b2c]"
              style={{ fontVariationSettings: "'FILL' 1" }}
              title="Verified workspace lead"
            >
              verified
            </span>
          </div>
          <p className="text-xs text-[#3e4a3d] leading-snug mt-0.5">
            {user.roleTitle || 'Staff Engineering Lead • UI Foundations'}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[11px] text-[#006b2c] font-semibold">
              {user.role === 'lead' ? 'Team Lead' : user.role === 'admin' ? 'Admin' : 'Core Pod'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#f2f3ff] text-[11px] text-[#3e4a3d]">
              {user.department || 'Core Pod'}
            </span>
          </div>
        </div>
      </div>

      {/* Availability Status Bar */}
      <div className="mb-4 p-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#006b2c] animate-pulse"></span>
          <span className="text-[#131b2e] font-medium">{user.statusText || 'Available (until 5:00 PM PST)'}</span>
        </div>
        <div className="flex items-center gap-1 text-[#6e7b6c]">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <span>10:35 AM PST</span>
        </div>
      </div>

      {/* Short Teammate Bio */}
      <div className="mb-4">
        <p className="text-xs text-[#3e4a3d] leading-relaxed">
          {user.bio ||
            "Architecting TeamHub's collaborative layout system and design token pipeline. Passionate about micro-interactions, clean API contracts, and high-velocity workflows."}
        </p>
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4 p-2.5 rounded-xl bg-[#ffffff] border border-[#eaedff] shadow-2xs">
        <div className="flex flex-col items-center justify-center p-1 text-center">
          <div className="flex items-center gap-1 text-[#131b2e] text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px] text-[#006b2c]">task_alt</span>
            <span>{user.tasksCompleted || 184}</span>
          </div>
          <span className="text-[10px] text-[#6e7b6c] uppercase tracking-wider mt-0.5">Delivered</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1 text-center border-l border-[#eaedff]">
          <div className="flex items-center gap-1 text-[#131b2e] text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px] text-[#0051d5]">forum</span>
            <span>{user.questionsAnswered || 42}</span>
          </div>
          <span className="text-[10px] text-[#6e7b6c] uppercase tracking-wider mt-0.5">Answers</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1 text-center border-l border-[#eaedff]">
          <div className="flex items-center gap-1 text-[#131b2e] text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px] text-[#8d4b00]">calendar_today</span>
            <span>3 yrs</span>
          </div>
          <span className="text-[10px] text-[#6e7b6c] uppercase tracking-wider mt-0.5">Oct 2021</span>
        </div>
      </div>

      {/* Skills & Focus Tags */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">
            Skills & Expertise
          </span>
          <span className="text-[11px] text-[#6e7b6c]">{user.location || 'San Francisco, CA'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {user.skills.map((skill, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-[#f2f3ff] text-[11px] text-[#131b2e] font-medium border border-[#eaedff]/60"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#eaedff]">
        <button
          onClick={() => {
            onDirectMessage(user);
            onClose();
          }}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-colors shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
          <span>Direct Message</span>
        </button>
        <button
          onClick={() => {
            onViewTasks(user);
            onClose();
          }}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-xs font-semibold transition-colors border border-[#eaedff] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-[#6e7b6c]">folder_open</span>
          <span>View Tasks ({user.tasksCompleted > 0 ? 14 : 0})</span>
        </button>
      </div>
    </div>
  );
};
