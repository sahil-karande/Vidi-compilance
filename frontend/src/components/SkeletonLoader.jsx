import 'react';

export const ChatMessageSkeleton = () => (
  <div className="flex flex-col gap-4 animate-pulse w-full max-w-3xl mx-auto p-4">
    <div className="flex items-start gap-3 justify-end">
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/3"></div>
    </div>
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></div>
      <div className="flex-1 space-y-3 py-1">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  </div>
);

export const DashboardCardSkeleton = () => (
  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-white dark:bg-slate-800 shadow-sm animate-pulse space-y-4">
    <div className="flex justify-between items-center">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
    </div>
    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
    <div className="space-y-2">
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5"></div>
    </div>
  </div>
);