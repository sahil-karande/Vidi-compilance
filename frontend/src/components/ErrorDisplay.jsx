import  'react';

export const ErrorDisplay = ({ type, message, onRetry }) => {
  const isLimitHit = type === 'LIMIT_EXHAUSTED' || message?.toLowerCase().includes('limit');

  return (
    <div className="flex flex-col items-center justify-center p-6 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 rounded-xl text-center max-w-md mx-auto my-4 transition-all duration-200">
      <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4">
        {isLimitHit ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        {isLimitHit ? "Daily Query Limit Reached" : "Connection Error"}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        {message || "We encountered an error processing your compliance query. Please check your network connection."}
      </p>
      {isLimitHit ? (
        <a href="#/settings" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
          Upgrade to Pro Plan
        </a>
      ) : (
        onRetry && (
          <button onClick={onRetry} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded-lg text-sm font-medium shadow-sm transition-colors">
            Try Again
          </button>
        )
      )}
    </div>
  );
};