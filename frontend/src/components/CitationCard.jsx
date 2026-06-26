import { useState, useEffect } from 'react';

/**
 * CitationChips Component
 * Renders small, interactive badges for each reference document.
 * 
 * @param {Array} citations - Array of citation objects [{ circular_no, date, authority, text, url }]
 * @param {Function} onSelect - Callback when a chip is clicked, passing the chosen citation data
 */
export const CitationChips = ({ citations, onSelect }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 self-center mr-1">
        Sources:
      </span>
      {citations.map((cite, index) => {
        // Fallback display formatting if fields are missing
        const label = cite.circular_no || `Source [${index + 1}]`;
        const displayDate = cite.date ? ` (${cite.date})` : '';

        return (
          <button
            key={index}
            onClick={() => onSelect(cite)}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-all hover:bg-blue-100 hover:text-blue-800 active:scale-95 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            <svg
              className="h-3 w-3 flex-shrink-0 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{label}{displayDate}</span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * CitationDrawer Component
 * A full height, slide-in sidebar on desktop that transitions to a bottom sheet on mobile screens.
 * Includes swipe-down look indicators, custom scroll lock, and direct external linking.
 * 
 * @param {Object} citation - Active citation object or null
 * @param {Function} onClose - Close callback
 */
export const CitationDrawer = ({ citation, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Synchronize internal visibility state to permit slide-out CSS transitions before total destruction
  useEffect(() => {
    if (citation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    } else {
      setIsOpen(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [citation]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Sync timing with transition speed
  };

  if (!citation) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Dark Translucent Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Main Drawer Shell */}
      <div
        className={`relative flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-900 sm:max-w-md md:max-w-lg
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          /* Mobile Overrides: Slide upward from bottom on smaller devices */
          max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[85vh] max-sm:rounded-t-2xl max-sm:w-full
          ${!isOpen && 'max-sm:translate-x-0 max-sm:translate-y-full'}
        `}
      >
        {/* Mobile Swipe/Pull Handle bar indicator */}
        <div className="hidden max-sm:flex w-full justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" onClick={handleClose} />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4 pt-3 dark:border-gray-800 sm:p-5">
          <div>
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              {citation.authority || 'Regulatory Body'}
            </span>
            <h3 className="mt-1 text-base font-bold text-gray-900 dark:text-white sm:text-lg">
              {citation.circular_no || 'Document Context'}
            </h3>
          </div>
          
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close panel"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Meta Fields Grid */}
        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 dark:bg-gray-950/30 dark:border-gray-800">
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Notification Date</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{citation.date || 'N/A'}</span>
            </div>
            {citation.section && (
              <div>
                <span className="text-gray-400 block mb-0.5">Relevant Section</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{citation.section}</span>
              </div>
            )}
          </div>
        </div>

        {/* Grounded Segment/Chunk Content Block */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Verified Regulatory Corpus Text
            </h4>
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 font-mono text-xs leading-relaxed text-gray-800 shadow-inner dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300">
              {citation.text || "No accompanying document context fragment was found matching this snippet."}
            </div>
          </div>
          
          <p className="mt-4 text-[11px] leading-normal text-gray-400 italic">
            Disclaimer: Grounded information parsed directly from public government resources. Always cross-verify final legal declarations via official Gazettes.
          </p>
        </div>

        {/* Bottom Actions Area */}
        {citation.url && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800 bg-white dark:bg-gray-900">
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.99]"
            >
              <span>Open Official Regulatory Document</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};