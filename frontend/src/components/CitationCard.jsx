import { useState, useEffect } from 'react';

/**
 * CitationChips Component
 * Renders simple, clean badges for each reference document.
 */
export const CitationChips = ({ citations, onSelect }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 self-center mr-1">
        Sources:
      </span>
      {citations.map((cite, index) => {
        // Render dynamic titles directly on the chip text labels
        const displayTitle = cite.circular_no || cite.title || cite.source || cite.filename || `Source [${index + 1}]`;
        const cleanLabel = displayTitle.length > 32 ? `${displayTitle.substring(0, 29)}...` : displayTitle;

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(cite)}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300 transition-all hover:bg-purple-500/20 hover:border-purple-500/40 active:scale-95"
          >
            <svg
              className="h-3 w-3 flex-shrink-0 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{cleanLabel}</span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * CitationDrawer Component
 * Displays un-truncated verified regulatory text snippets clearly.
 */
export const CitationDrawer = ({ citation, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (citation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
      document.body.style.overflow = 'hidden'; 
    } else {
      setIsOpen(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [citation]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); 
  };

  if (!citation) return null;

  // Unified fallback resolution tree matching your RAG data models
  const drawerHeaderTitle = citation.circular_no || citation.title || citation.source || citation.authority || 'Regulatory Reference Context';
  const drawerBodyText = citation.text || citation.preview || citation.excerpt || citation.content || "Verified regulatory context text block.";

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Dark Translucent Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={handleClose} />

      {/* Drawer Panel */}
      <div
        className={`relative flex h-full w-full flex-col bg-[#12131A] text-slate-200 border-l border-white/10 shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-md md:max-w-lg
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[80vh] max-sm:rounded-t-2xl max-sm:w-full max-sm:border-t max-sm:border-l-0
          ${!isOpen && 'max-sm:translate-x-0 max-sm:translate-y-full'}
        `}
      >
        {/* Mobile Swipe Handle */}
        <div className="hidden max-sm:flex w-full justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-slate-700" onClick={handleClose} />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4 pt-3 sm:p-5">
          <div className="text-left flex-1 min-w-0 pr-4">
            <span className="inline-flex items-center rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-300">
              Grounded Source Document
            </span>
            <h3 className="mt-1 text-sm font-bold text-white sm:text-base break-words leading-snug">
              {drawerHeaderTitle}
            </h3>
          </div>
          
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white shrink-0 self-start mt-1 transition-colors"
            aria-label="Close panel"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grounded Segment/Chunk Content Block */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-left">
          <div className="prose prose-sm max-w-none prose-invert">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Verified Regulatory Corpus Text
            </h4>
            <div className="rounded-xl border border-white/10 bg-[#16161F] p-4 font-mono text-xs leading-relaxed text-slate-300 shadow-inner whitespace-pre-wrap">
              {drawerBodyText}
            </div>
          </div>
          
          <p className="mt-4 text-[11px] leading-normal text-slate-500 italic">
            Disclaimer: Grounded information parsed directly from public government resources. Always cross-verify final legal declarations via official Gazettes.
          </p>
        </div>

        {/* Bottom Actions Area */}
        {citation.url && citation.url !== '#' && (
          <div className="border-t border-white/10 p-4 bg-[#12131A]">
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] transition-all hover:bg-purple-500 focus:outline-none active:scale-[0.99]"
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