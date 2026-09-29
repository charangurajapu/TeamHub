import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
  onExitMobile: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  onExitMobile,
}) => {
  return (
    <div className="min-h-screen bg-[#1e293b] flex flex-col items-center justify-center p-2 sm:p-6 lg:p-10 select-none">
      {/* Top Device Switcher Floating Bar */}
      <div className="mb-4 flex items-center gap-3 bg-[#0f172a]/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 text-xs text-white shadow-xl z-50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
          <span className="font-semibold tracking-wide">React Native Simulator</span>
        </div>
        <div className="h-3.5 w-px bg-slate-600"></div>
        <span className="text-slate-300 hidden sm:inline">iOS / Android Prototype Frame</span>
        <button
          onClick={onExitMobile}
          className="ml-2 px-3 py-1 rounded-full bg-[#006b2c] hover:bg-[#00873a] text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
        >
          <span className="material-symbols-outlined text-[15px]">desktop_windows</span>
          <span>Switch to Desktop View</span>
        </button>
      </div>

      {/* Realistic Smartphone Chassis Frame */}
      <div className="relative w-full max-w-[412px] h-[860px] max-h-[calc(100vh-100px)] rounded-[50px] bg-[#090d16] p-[12px] shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_0_4px_#334155,0_0_0_8px_#0f172a] flex flex-col overflow-hidden">
        {/* Phone Speaker & Dynamic Island Top Bar */}
        <div className="absolute top-3 left-0 right-0 z-50 flex items-center justify-between px-8 pointer-events-none text-white text-[12px] font-semibold">
          <span>9:41</span>
          {/* Dynamic Island */}
          <div className="w-24 h-5 rounded-full bg-[#000000] border border-slate-800 flex items-center justify-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#006b2c]/80"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="material-symbols-outlined text-[14px]">signal_cellular_4_bar</span>
            <span className="material-symbols-outlined text-[14px]">wifi</span>
            <span className="material-symbols-outlined text-[15px]">battery_full</span>
          </div>
        </div>

        {/* Screen Viewport with safe-area radii */}
        <div className="relative w-full h-full rounded-[40px] overflow-hidden bg-[#faf8ff] flex flex-col pt-7">
          {/* Scrollable Screen Content */}
          <div className="w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar">
            {children}
          </div>

          {/* iOS Bottom Home Swipe Indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-slate-800/40 pointer-events-none z-50"></div>
        </div>
      </div>
    </div>
  );
};
