import React from 'react';
import { ViewMode } from '../../types';

interface MobileTabBarProps {
  currentTab: 'home' | 'tasks' | 'channels' | 'questions' | 'ai-assistant';
  onSelectTab: (tab: 'home' | 'tasks' | 'channels' | 'questions' | 'ai-assistant') => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  currentTab,
  onSelectTab,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#faf8ff]/90 backdrop-blur-xl border-t border-[#eaedff] shadow-[0_-2px_12px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="h-16 flex items-center justify-around px-2">
        {/* Home */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center w-14 h-12 transition-colors cursor-pointer ${
            currentTab === 'home' ? 'text-[#006b2c] font-semibold' : 'text-[#3e4a3d] hover:text-[#131b2e]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: currentTab === 'home' ? "'FILL' 1" : "'FILL' 0" }}
          >
            home
          </span>
          <span className="text-[11px] mt-0.5">Home</span>
        </button>

        {/* Tasks */}
        <button
          onClick={() => onSelectTab('tasks')}
          className={`flex flex-col items-center justify-center w-14 h-12 transition-colors cursor-pointer ${
            currentTab === 'tasks' ? 'text-[#006b2c] font-semibold' : 'text-[#3e4a3d] hover:text-[#131b2e]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: currentTab === 'tasks' ? "'FILL' 1" : "'FILL' 0" }}
          >
            check_circle
          </span>
          <span className="text-[11px] mt-0.5">Tasks</span>
        </button>

        {/* Channels */}
        <button
          onClick={() => onSelectTab('channels')}
          className={`flex flex-col items-center justify-center w-14 h-12 transition-colors cursor-pointer relative ${
            currentTab === 'channels' ? 'text-[#006b2c] font-semibold' : 'text-[#3e4a3d] hover:text-[#131b2e]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: currentTab === 'channels' ? "'FILL' 1" : "'FILL' 0" }}
          >
            tag
          </span>
          <span className="text-[11px] mt-0.5">Channels</span>
        </button>

        {/* Q&A */}
        <button
          onClick={() => onSelectTab('questions')}
          className={`flex flex-col items-center justify-center w-14 h-12 transition-colors cursor-pointer ${
            currentTab === 'questions' ? 'text-[#006b2c] font-semibold' : 'text-[#3e4a3d] hover:text-[#131b2e]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: currentTab === 'questions' ? "'FILL' 1" : "'FILL' 0" }}
          >
            help_center
          </span>
          <span className="text-[11px] mt-0.5">Q&A</span>
        </button>

        {/* AI Assistant */}
        <button
          onClick={() => onSelectTab('ai-assistant')}
          className={`flex flex-col items-center justify-center w-14 h-12 transition-colors cursor-pointer ${
            currentTab === 'ai-assistant' ? 'text-[#006b2c] font-semibold' : 'text-[#3e4a3d] hover:text-[#131b2e]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: currentTab === 'ai-assistant' ? "'FILL' 1" : "'FILL' 0" }}
          >
            auto_awesome
          </span>
          <span className="text-[11px] mt-0.5">Assistant</span>
        </button>
      </div>
    </nav>
  );
};
