import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AssistantMessageProps {
  id: string;
  text: string;
  time: string;
  isStructured?: boolean;
  onRegenerate?: () => void;
  onSaveToFiles?: () => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  text,
  time,
  onRegenerate,
  onSaveToFiles,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-3 md:gap-3.5 w-full animate-in fade-in duration-250">
      {/* AI Avatar */}
      <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-[18px] md:text-[20px]">smart_toy</span>
      </div>

      {/* AI Text Body */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="font-semibold text-xs text-on-surface">TeamHub Intelligence</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
            gpt-4o-enterprise
          </span>
          <span className="text-[11px] text-on-surface-variant">• {time}</span>
        </div>

        <div className="bg-surface-container-lowest p-4 md:p-5 rounded-2xl border border-surface-container-high/40 shadow-xs text-on-surface flex flex-col gap-3">
          <MarkdownRenderer content={text} />

          {/* Sources Reference Pill Group */}
          <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-surface-container-high/30">
            <span className="text-[11px] text-on-surface-variant">Sources Indexed:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-[11px] text-on-surface">
              <span className="material-symbols-outlined text-[13px] text-primary">tag</span>
              #backend-incidents
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-[11px] text-on-surface">
              <span className="material-symbols-outlined text-[13px] text-secondary">description</span>
              RFC-108: Redis Sentinel Spec
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-[11px] text-on-surface">
              <span className="material-symbols-outlined text-[13px] text-tertiary">commit</span>
              pr #4812
            </span>
          </div>

          {/* Action Toolbar for Assistant Response */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/60 flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors text-xs font-medium cursor-pointer"
                type="button"
                title="Copy response to clipboard"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors text-xs font-medium cursor-pointer"
                  type="button"
                  title="Regenerate this response"
                >
                  <span className="material-symbols-outlined text-[16px]">replay</span>
                  <span>Regenerate</span>
                </button>
              )}

              <div className="h-3 w-px bg-surface-container-high mx-1"></div>

              <button
                aria-label="Helpful"
                onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  feedback === 'liked'
                    ? 'text-primary bg-primary/10'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`}
                type="button"
                title="Helpful"
              >
                <span className="material-symbols-outlined text-[16px]">thumb_up</span>
              </button>

              <button
                aria-label="Not helpful"
                onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  feedback === 'disliked'
                    ? 'text-error bg-error/10'
                    : 'text-on-surface-variant hover:text-error hover:bg-surface-container-low'
                }`}
                type="button"
                title="Not helpful"
              >
                <span className="material-symbols-outlined text-[16px]">thumb_down</span>
              </button>
            </div>

            {onSaveToFiles && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onSaveToFiles}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors text-xs font-semibold cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                  <span>Save to Files</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
