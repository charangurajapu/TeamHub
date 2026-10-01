import React from 'react';
import { SuggestionCard } from './SuggestionCard';

interface EmptyStateProps {
  userName?: string;
  onSelectPrompt: (prompt: string, shouldSendImmediately?: boolean) => void;
}

const DEFAULT_SUGGESTIONS = [
  {
    icon: 'description',
    title: 'Summarize a document',
    description: 'Synthesize key decisions, RFCs, or meeting transcripts into high-priority action items.',
    prompt: 'Summarize key architectural decisions, RFCs, and meeting notes from this week.',
  },
  {
    icon: 'edit_note',
    title: 'Draft an update',
    description: 'Generate sprint recap emails, async standup notes, or milestone executive summaries.',
    prompt: 'Draft an engineering sprint recap email focusing on release blocker resolutions.',
  },
  {
    icon: 'analytics',
    title: 'Analyze data & velocity',
    description: 'Extract sprint velocity metrics, blockers, and cycle-time bottlenecks across active pods.',
    prompt: 'Analyze cycle times and review queue bottlenecks across pod alpha repositories.',
  },
  {
    icon: 'saved_search',
    title: 'Answer a question',
    description: 'Search indexed workspace channels, design RFCs, and merged pull request threads.',
    prompt: 'Search knowledge base and answered threads for Redis Sentinel failover strategy.',
  },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ userName, onSelectPrompt }) => {
  const firstName = userName ? userName.split(' ')[0] : 'there';

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">smart_toy</span>
          <h2 className="text-lg md:text-xl font-semibold text-on-surface tracking-tight">
            How can I assist your sprint today, {firstName}?
          </h2>
        </div>
        <span className="text-[11px] text-on-surface-variant">
          Click card to run prompt • Shift + Click to insert into input
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEFAULT_SUGGESTIONS.map((item) => (
          <SuggestionCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            prompt={item.prompt}
            onSelect={onSelectPrompt}
          />
        ))}
      </div>
    </div>
  );
};
