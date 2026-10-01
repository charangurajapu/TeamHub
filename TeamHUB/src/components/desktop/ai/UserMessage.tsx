import React from 'react';
import { User } from '../../../types';

interface UserMessageProps {
  text: string;
  time: string;
  currentUser?: User;
}

export const UserMessage: React.FC<UserMessageProps> = ({ text, time, currentUser }) => {
  const roleName =
    currentUser?.role === 'admin'
      ? 'Administrator'
      : currentUser?.role === 'lead'
      ? 'Team Lead'
      : currentUser?.role === 'member'
      ? 'Team Member'
      : 'Engineering';

  return (
    <div className="flex flex-col items-end gap-1.5 self-end max-w-2xl pl-10 md:pl-16 w-full animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-on-surface-variant font-medium">
          {currentUser?.name || 'You'} • {roleName}
        </span>
        <span className="text-[11px] text-on-surface-variant">{time}</span>
      </div>

      <div className="px-4 py-3 rounded-2xl rounded-tr-xs bg-primary-fixed/35 text-on-surface shadow-xs border border-primary-fixed/30 max-w-full">
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>
      </div>

      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px] text-primary">done_all</span>
        <span className="text-[11px]">Sent to Pod Context</span>
      </div>
    </div>
  );
};
