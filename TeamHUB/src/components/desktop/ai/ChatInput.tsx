import React, { useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (text?: string) => void;
  isLoading: boolean;
  onOpenDocPreview?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  isLoading,
  onOpenDocPreview,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSend();
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSend();
    }
  };

  return (
    <div className="w-full max-w-3xl pointer-events-auto">
      {/* Elevated Input Container */}
      <form
        onSubmit={handleFormSubmit}
        className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high/60 p-2 flex flex-col transition-all focus-within:shadow-2xl focus-within:ring-2 focus-within:ring-primary/20"
      >
        {/* Context Pills Top Bar inside Input */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1.5 border-b border-surface-container/50">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[14px]">tune</span>
              Context:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              #backend
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              #general
            </span>
            {onOpenDocPreview && (
              <button
                type="button"
                onClick={onOpenDocPreview}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-primary hover:bg-surface-container-low transition-colors text-[11px] font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">magic_button</span>
                <span>Teamwork Doc</span>
              </button>
            )}
          </div>
          <span className="text-[11px] text-on-surface-variant hidden sm:inline-block">
            Drafting via Pod-V4
          </span>
        </div>

        {/* Textarea Field */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI Assistant about sprint progress, code, or documentation... (Press Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={isLoading}
          className="w-full px-2.5 py-2 bg-transparent text-on-surface placeholder:text-on-surface-variant text-sm resize-none focus:outline-none leading-relaxed disabled:opacity-50"
        />

        {/* Bottom Action Bar inside Container */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              title="Attach documents or telemetry"
            >
              <span className="material-symbols-outlined text-[18px]">attach_file</span>
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              title="Insert workspace code link"
            >
              <span className="material-symbols-outlined text-[18px]">terminal</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onChange(
                  'Summarize the key architectural decisions from our recent design sprint.'
                )
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              title="Insert prompt template"
            >
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              title="Voice Dictation"
            >
              <span className="material-symbols-outlined text-[18px]">mic</span>
            </button>

            <button
              type="submit"
              disabled={!value.trim() || isLoading}
              className="h-8 px-4 rounded-lg bg-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <span>Send</span>
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
          </div>
        </div>
      </form>

      {/* Disclaimers & Model Info */}
      <div className="flex items-center justify-center gap-1.5 mt-2 px-3 text-center">
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">shield</span>
        <p className="text-[11px] text-on-surface-variant">
          AI generated output can contain inaccuracies. Validate architectural decisions with team
          leads and linked repo commits.
        </p>
      </div>
    </div>
  );
};
