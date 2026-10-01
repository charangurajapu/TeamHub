import React, { useState } from 'react';
import { User, ViewMode } from '../../types';
import { generateGeminiAssistantResponse } from '../../lib/gemini';
import { AiDocPreviewPanel } from '../common/AiDocPreviewPanel';
import { useSidebar } from '../../context/SidebarContext';

import { ChatHeader } from './ai/ChatHeader';
import { MessageList, ChatMessage } from './ai/MessageList';
import { ChatInput } from './ai/ChatInput';

interface AiAssistantViewProps {
  currentUser: User;
  onNavigate: (view: ViewMode) => void;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({ currentUser, onNavigate }) => {
  const { isCollapsed } = useSidebar();
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-seed-user',
      sender: 'user',
      text: "Summarize the architectural consensus from yesterday's Redis cluster failover discussion in #backend.",
      time: '10:32 AM',
    },
    {
      id: 'm-seed-ai',
      sender: 'ai',
      text: `### Key Decisions: Redis Multi-Region Failover Architecture

Synthesized from yesterday's post-incident triage between **@marcus** and **@devon** regarding cross-DC replication latency:

- **Lua Script Execution:** Swapped high-frequency client renew loops with atomic scripts executing directly on Redis nodes to avert distributed lease stampedes during transient splits.
- **180s Proxy Buffer:** Envoy ingress buffers downstream mutations during master election phases, absorbing NTP jitter across active-active clusters without invoking global write locks.
- **Fallback Sentinel Consensus:** Enforced quorum threshold to \`N/2 + 1\` with a minimum heartbeat variance cap of 450ms.

\`\`\`lua
-- atomic_lease_acquire.lua
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')
\`\`\``,
      time: '10:33 AM',
      isStructured: true,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Send message handler
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputVal).trim();
    if (!text || isThinking) return;

    setErrorMessage(null);
    const newMsgId = `u-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: newMsgId,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsThinking(true);

    // Build chat history for Gemini context
    const history = messages.map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
      text: m.text,
    }));

    try {
      const result = await generateGeminiAssistantResponse(text, history);
      setIsThinking(false);

      if (result.error) {
        setErrorMessage(result.error);
      }

      const aiResponseText = result.text || 'Sorry, I was unable to generate a response.';

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiResponseText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: unknown) {
      setIsThinking(false);
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ **Error generating response:** ${errMsg}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Regeneration logic for an assistant message
  const handleRegenerate = (aiMsgIndex: number) => {
    // Find the preceding user message
    let precedingUserPrompt = '';
    for (let i = aiMsgIndex - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        precedingUserPrompt = messages[i].text;
        break;
      }
    }
    if (precedingUserPrompt) {
      handleSend(precedingUserPrompt);
    }
  };

  // Suggestion card interaction: either send immediately or populate input
  const handleSelectPrompt = (prompt: string, shouldSendImmediately = true) => {
    if (shouldSendImmediately) {
      handleSend(prompt);
    } else {
      setInputVal(prompt);
    }
  };

  // Reset conversation
  const handleNewChat = () => {
    setMessages([]);
    setInputVal('');
    setErrorMessage(null);
  };

  return (
    <div className="relative flex flex-col w-full min-h-[calc(100vh-5rem)] bg-surface text-on-surface">
      {/* Slim Context Header Bar */}
      <ChatHeader
        onNewChat={handleNewChat}
        onOpenDocPreview={() => setShowDocPreview(true)}
      />

      {/* Error notification banner if any */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-3">
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-on-error-container hover:opacity-75 cursor-pointer font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Scrollable Conversation Timeline */}
      <main className="flex-1 w-full">
        <MessageList
          messages={messages}
          currentUser={currentUser}
          isThinking={isThinking}
          onSelectPrompt={handleSelectPrompt}
          onRegenerate={handleRegenerate}
          onSaveToFiles={() => setShowDocPreview(true)}
        />
      </main>

      {/* Pinned Floating Prompt Input Centerpiece */}
      <div
        className={`fixed bottom-0 ${
          isCollapsed ? 'left-0 lg:left-18' : 'left-0 lg:left-64'
        } right-0 z-30 p-3 md:p-4 flex flex-col items-center pointer-events-none transition-all duration-300`}
      >
        <ChatInput
          value={inputVal}
          onChange={setInputVal}
          onSend={handleSend}
          isLoading={isThinking}
          onOpenDocPreview={() => setShowDocPreview(true)}
        />
      </div>

      {/* Slide-out AI Documentation Preview Panel with Backdrop */}
      {showDocPreview && (
        <>
          <div
            id="backdrop"
            className={`fixed inset-0 top-16 left-0 ${
              isCollapsed ? 'lg:left-18' : 'lg:left-64'
            } bg-[#131b2e]/25 backdrop-blur-[2px] z-40 transition-all duration-300 ease-in-out animate-in fade-in cursor-pointer`}
            onClick={() => setShowDocPreview(false)}
          />
          <div
            className="fixed top-16 right-0 h-[calc(100vh-64px)] w-full sm:w-[580px] z-50 flex flex-col animate-in slide-in-from-right duration-300 ease-out shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AiDocPreviewPanel
              currentUser={currentUser}
              onClose={() => setShowDocPreview(false)}
              onBackToChat={() => setShowDocPreview(false)}
              onNavigateToFiles={() => onNavigate('files')}
              isDrawerMode={true}
            />
          </div>
        </>
      )}
    </div>
  );
};
