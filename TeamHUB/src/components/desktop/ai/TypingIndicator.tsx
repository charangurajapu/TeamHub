import React from 'react';

interface TypingIndicatorProps {
  statusText?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  statusText = 'TeamHub AI is synthesizing workspace telemetry...',
}) => {
  return (
    <div className="flex items-center gap-3 pl-11 md:pl-12 py-1 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-surface-container-high/50 shadow-xs">
        <div className="flex space-x-1 items-center">
          <div
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></div>
          <div
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></div>
          <div
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></div>
        </div>
        <span className="text-xs text-on-surface-variant font-medium">{statusText}</span>
      </div>
    </div>
  );
};
