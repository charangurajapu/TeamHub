import React from 'react';

interface ChatHeaderProps {
  onNewChat: () => void;
  onOpenDocPreview?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onNewChat, onOpenDocPreview }) => {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between py-2 px-3 md:px-4 bg-surface/90 backdrop-blur-md border-b border-surface-container-high/60 transition-all">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-container-lowest shadow-xs flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm md:text-base text-on-surface tracking-tight">
              TeamHub Intelligence
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-medium">
              v2.4 Enterprise
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Online • Connected to Pod Context (6 sources synced)
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-1.5">
        <button
          onClick={onNewChat}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-xs hover:shadow-sm hover:bg-surface-container-low transition-all cursor-pointer text-xs font-medium"
          type="button"
          title="Start a new chat (⌘N)"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">add</span>
          <span>New Chat</span>
          <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.5 bg-surface-container-high rounded text-on-surface-variant group-hover:bg-surface-container-highest">
            ⌘N
          </kbd>
        </button>

        {onOpenDocPreview && (
          <button
            onClick={onOpenDocPreview}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors text-xs font-medium cursor-pointer"
            type="button"
            title="Open Team Documentation Draft"
          >
            <span className="material-symbols-outlined text-[16px]">magic_button</span>
            <span className="hidden sm:inline">Docs</span>
          </button>
        )}

        <div className="h-4 w-px bg-surface-container-high mx-1"></div>

        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
          title="Model Parameters: gpt-4o-enterprise & gemini-2.5"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
        </button>
      </div>
    </div>
  );
};
