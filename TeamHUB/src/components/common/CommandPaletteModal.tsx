import React, { useState, useEffect } from 'react';
import { ViewMode } from '../../types';
import { CHANNELS, INITIAL_TASKS, INITIAL_QUESTIONS, WORKSPACE_FILES, USERS } from '../../data/mockData';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewMode, itemId?: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const filteredChannels = CHANNELS.filter((c) => c.name.toLowerCase().includes(q));
  const filteredTasks = INITIAL_TASKS.filter(
    (t) => t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)
  );
  const filteredQuestions = INITIAL_QUESTIONS.filter(
    (qn) => qn.title.toLowerCase().includes(q) || qn.tags.some((t) => t.includes(q))
  );
  const filteredFiles = WORKSPACE_FILES.filter((f) => f.name.toLowerCase().includes(q));
  const filteredMembers = Object.values(USERS).filter(
    (u) => u.name.toLowerCase().includes(q) || u.roleTitle.toLowerCase().includes(q)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#131b2e]/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#ffffff] rounded-2xl shadow-2xl border border-[#eaedff] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#eaedff]">
          <span className="material-symbols-outlined text-[22px] text-[#006b2c] mr-3">search</span>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, channel, task (#...), or question..."
            className="w-full bg-transparent text-sm text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none"
          />
          <span className="px-2 py-0.5 rounded-md bg-[#f2f3ff] text-[11px] text-[#6e7b6c] font-semibold">
            ESC
          </span>
        </div>

        {/* Results Container */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[#eaedff]/60">
          {/* Quick Views */}
          {!q && (
            <div className="py-2">
              <span className="px-3 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block mb-1">
                Workspace Sections
              </span>
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    onNavigate('home');
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs font-medium text-[#131b2e] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">home</span>
                  <span>Home Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('tasks');
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs font-medium text-[#131b2e] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">check_circle</span>
                  <span>Sprint 42 Kanban Board</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('channels');
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs font-medium text-[#131b2e] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">forum</span>
                  <span>Channels & Communications</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('questions');
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs font-medium text-[#131b2e] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">help_center</span>
                  <span>Q&A Knowledge Base</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('files');
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs font-medium text-[#131b2e] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">folder</span>
                  <span>Files & Architecture Specs</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('ai-assistant');
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs font-medium text-[#131b2e] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006b2c]">auto_awesome</span>
                  <span>AI Assistant Workspace</span>
                </button>
              </div>
            </div>
          )}

          {/* Tasks Results */}
          {filteredTasks.length > 0 && (
            <div className="py-2">
              <span className="px-3 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block mb-1">
                Tasks
              </span>
              <div className="space-y-0.5">
                {filteredTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onNavigate('tasks', t.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs text-[#131b2e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-[#006b2c]">{t.key}</span>
                      <span className="truncate">{t.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] capitalize shrink-0 ml-2">
                      {t.status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Channels Results */}
          {filteredChannels.length > 0 && (
            <div className="py-2">
              <span className="px-3 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block mb-1">
                Channels
              </span>
              <div className="space-y-0.5">
                {filteredChannels.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onNavigate('channels', c.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs text-[#131b2e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">tag</span>
                      <span className="font-medium">#{c.name}</span>
                    </div>
                    <span className="text-[11px] text-[#6e7b6c]">{c.membersCount} members</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Questions Results */}
          {filteredQuestions.length > 0 && (
            <div className="py-2">
              <span className="px-3 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block mb-1">
                Questions
              </span>
              <div className="space-y-0.5">
                {filteredQuestions.slice(0, 2).map((qn) => (
                  <button
                    key={qn.id}
                    onClick={() => {
                      onNavigate('questions', qn.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs text-[#131b2e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-[#0051d5]">{qn.key}</span>
                      <span className="truncate">{qn.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7ffc97]/40 text-[#005320] font-semibold shrink-0 ml-2">
                      {qn.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {filteredMembers.length > 0 && (
            <div className="py-2">
              <span className="px-3 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block mb-1">
                Teammates
              </span>
              <div className="space-y-0.5">
                {filteredMembers.slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onNavigate('channels');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#f2f3ff] text-xs text-[#131b2e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-[10px] flex items-center justify-center">
                        {m.initials}
                      </div>
                      <span className="font-medium">{m.name}</span>
                    </div>
                    <span className="text-[11px] text-[#6e7b6c]">{m.roleTitle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#faf8ff] border-t border-[#eaedff] flex items-center justify-between text-[11px] text-[#6e7b6c]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <span className="font-medium text-[#006b2c]">TeamHub Quick Index</span>
        </div>
      </div>
    </div>
  );
};
