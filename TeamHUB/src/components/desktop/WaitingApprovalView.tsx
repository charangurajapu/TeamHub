import React, { useState, useEffect } from 'react';

interface WaitingApprovalViewProps {
  onBackToApp: () => void;
}

export const WaitingApprovalView: React.FC<WaitingApprovalViewProps> = ({ onBackToApp }) => {
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col items-center justify-center p-4 text-[#131b2e]">
      <div className="w-full max-w-[480px] bg-[#ffffff] rounded-3xl shadow-sm border border-[#eaedff] p-8 sm:p-10 flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#7ffc97]/30 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-[#006b2c] text-white flex items-center justify-center font-bold">
            TH
          </div>
          <span className="text-xl font-bold tracking-tight">TeamHub</span>
        </div>

        {/* Illustration */}
        <div className="w-32 h-32 rounded-full bg-[#f2f3ff] flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[54px] text-[#006b2c]">hourglass_top</span>
        </div>

        {/* Typography */}
        <h1 className="text-2xl font-bold tracking-tight mb-2">Waiting for approval</h1>
        <p className="text-sm font-semibold text-[#131b2e] mb-1">
          Your request has been sent to your team lead
        </p>
        <p className="text-xs text-[#6e7b6c] leading-relaxed max-w-sm mb-6">
          We've notified <strong className="text-[#131b2e]">Sarah Connor</strong> and the workspace administrators. You will receive an email confirmation once your account has been approved.
        </p>

        {/* Request Details */}
        <div className="w-full bg-[#f2f3ff] rounded-2xl p-4 mb-6 text-left border border-[#eaedff]">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#eaedff]">
            <span className="text-[10px] uppercase font-bold text-[#6e7b6c]">Request Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#2f1500] text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8d4b00] animate-ping"></span>
              Pending Review
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6e7b6c]">Requested Role</span>
              <span className="font-semibold text-[#131b2e]">Team Member</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e7b6c]">Workspace</span>
              <span className="font-semibold text-[#131b2e]">Core Engineering</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e7b6c]">Submitted</span>
              <span className="text-[#131b2e]">Just now</span>
            </div>
          </div>
        </div>

        <button
          onClick={onBackToApp}
          className="w-full py-2.5 bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
        >
          Enter Workspace Demo
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#6e7b6c]">
          <span className="w-2 h-2 rounded-full bg-[#006b2c] animate-pulse"></span>
          <span>Auto-refreshing status in {secondsLeft}s</span>
        </div>
      </div>
    </div>
  );
};
