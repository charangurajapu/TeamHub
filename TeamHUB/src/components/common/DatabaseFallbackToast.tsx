import React, { useState, useEffect } from 'react';
import { DatabaseFallbackDetail } from '../../lib/supabase';

interface FallbackAlert extends DatabaseFallbackDetail {
  id: string;
}

export const DatabaseFallbackToast: React.FC = () => {
  const [alerts, setAlerts] = useState<FallbackAlert[]>([]);

  useEffect(() => {
    const handleFallbackEvent = (e: Event) => {
      const customEvent = e as CustomEvent<DatabaseFallbackDetail>;
      if (!customEvent.detail) return;

      const newAlert: FallbackAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...customEvent.detail,
      };

      setAlerts((prev) => [newAlert, ...prev.slice(0, 3)]); // Keep at most 4 latest

      // Auto-dismiss individual alert after 10 seconds
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
      }, 10000);
    };

    window.addEventListener('teamhub:database-fallback', handleFallbackEvent);
    return () => {
      window.removeEventListener('teamhub:database-fallback', handleFallbackEvent);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0"
      role="region"
      aria-label="Database Fallback Notifications"
    >
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto flex items-start gap-3.5 p-4 rounded-xl bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 border border-amber-500/40 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <span className="material-symbols-outlined text-[20px]">cloud_off</span>
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {alert.operation}
              </span>
              <span className="text-[11px] text-amber-400/90 font-medium">Server Sync Failed</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed break-words">
              {alert.error || 'Server rejected the write request.'}
            </p>

            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-amber-400">warning</span>
              Saved to local storage on this device only. Not synced to server.
            </p>
          </div>

          <button
            onClick={() => handleDismiss(alert.id)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-100 p-1 rounded-md hover:bg-slate-800 transition-colors"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};
