import React, { useRef, useEffect } from 'react';
import { User } from '../../../types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { TypingIndicator } from './TypingIndicator';
import { EmptyState } from './EmptyState';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  isStructured?: boolean;
}

interface MessageListProps {
  messages: ChatMessage[];
  currentUser: User;
  isThinking: boolean;
  onSelectPrompt: (prompt: string, shouldSendImmediately?: boolean) => void;
  onRegenerate: (index: number) => void;
  onSaveToFiles: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUser,
  isThinking,
  onSelectPrompt,
  onRegenerate,
  onSaveToFiles,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or thinking state
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="w-full max-w-4xl mx-auto px-3 md:px-6 pb-48 pt-4 flex flex-col gap-6">
      {/* Starter Suggestion / Clean Empty State Panel */}
      <EmptyState userName={currentUser.name} onSelectPrompt={onSelectPrompt} />

      {/* Active Conversation Timeline */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-5 pt-2">
          {/* Timestamp Divider */}
          <div className="flex items-center justify-center my-1">
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium border border-surface-container">
              Today • Sprint 41 Context Window
            </span>
          </div>

          {/* Messages */}
          {messages.map((msg, index) => {
            if (msg.sender === 'user') {
              return (
                <UserMessage
                  key={msg.id}
                  text={msg.text}
                  time={msg.time}
                  currentUser={currentUser}
                />
              );
            }
            return (
              <AssistantMessage
                key={msg.id}
                id={msg.id}
                text={msg.text}
                time={msg.time}
                isStructured={msg.isStructured}
                onRegenerate={() => onRegenerate(index)}
                onSaveToFiles={onSaveToFiles}
              />
            );
          })}

          {/* Live Analyzing / Thinking Indicator */}
          {isThinking && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
