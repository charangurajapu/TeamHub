import React from 'react';

interface SuggestionCardProps {
  icon: string;
  title: string;
  description: string;
  prompt: string;
  onSelect: (prompt: string, shouldSendImmediately?: boolean) => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  icon,
  title,
  description,
  prompt,
  onSelect,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    // If shift is pressed or regular click, pass to onSelect
    const shouldSendImmediately = !e.shiftKey;
    onSelect(prompt, shouldSendImmediately);
  };

  return (
    <button
      onClick={handleClick}
      className="group flex flex-col text-left p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/40 shadow-xs hover:shadow-md hover:bg-surface-container-low transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
      type="button"
    >
      <div className="flex items-center justify-between w-full mb-1">
        <span className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
          {title}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-0.5 group-hover:text-primary text-[16px] transition-all">
          arrow_forward
        </span>
      </div>
      <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
        {description}
      </p>
    </button>
  );
};
