/**
 * Vidi — frontend/src/components/PwaInstallPrompt.jsx
 * Responsive PWA Installation Banner & Instructional Modal for Desktop & Mobile
 */

import React from 'react';
import { Download, X, Share, PlusSquare, Monitor, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

/**
 * Compact Navbar Install Button for Desktop & Mobile navigation bars
 */
export function PwaNavButton({ className = '' }) {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();

  if (isInstalled || !isInstallable) {
    return null;
  }

  return (
    <button
      onClick={promptInstall}
      className={`relative group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold 
      bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 
      border border-purple-500/40 hover:border-purple-400 text-purple-200 hover:text-white 
      shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] 
      transition-all duration-200 active:scale-95 select-none ${className}`}
      title="Install Vidi as a desktop or mobile application"
      aria-label="Install Vidi App"
    >
      <Download className="w-3.5 h-3.5 text-purple-300 group-hover:animate-bounce" />
      <span>Install App</span>
      <span className="flex h-1.5 w-1.5 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
      </span>
    </button>
  );
}

/**
 * Main Floating Banner & Platform Guides
 */
export default function PwaInstallPrompt() {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    showBanner,
    showIOSModal,
    hasNativePrompt,
    promptInstall,
    dismissBanner,
    closeIOSModal
  } = usePwaInstall();

  if (isInstalled || (!showBanner && !showIOSModal)) {
    return null;
  }

  return (
    <>
      {/* 1. FLOATING DESKTOP BANNER (Bottom-Right Floating Card) */}
      {showBanner && isInstallable && (
        <aside
          aria-label="PWA install prompt"
          className="hidden md:flex fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#13141B]/95 backdrop-blur-xl 
          border border-purple-500/30 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(168,85,247,0.15)] 
          animate-in fade-in slide-in-from-bottom-5 duration-300 flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-800/30 border border-purple-500/40 flex items-center justify-center p-1.5 shadow-inner shrink-0">
                <img src="/vidi_icon_only.png" alt="Vidi Logo" className="w-full h-full object-contain rounded-lg" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Install Vidi Desktop App</h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                  Fast access & native window experience.
                </p>
              </div>
            </div>
            <button
              onClick={dismissBanner}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={promptInstall}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold 
              bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 
              text-white shadow-[0_4px_16px_rgba(147,51,234,0.4)] transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
            <button
              onClick={dismissBanner}
              className="py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              Not now
            </button>
          </div>
        </aside>
      )}

      {/* 2. MOBILE BOTTOM INSTALL BANNER (Thumb-friendly mobile bottom bar) */}
      {showBanner && isInstallable && (
        <aside
          aria-label="PWA mobile install prompt"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#13141B]/95 backdrop-blur-2xl 
          border-t border-purple-500/30 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] 
          shadow-[0_-10px_35px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/vidi_icon_only.png"
                alt="Vidi App Icon"
                className="w-9 h-9 rounded-xl object-contain border border-purple-500/30 p-1 bg-purple-950/40 shrink-0"
              />
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">Install Vidi App</h4>
                <p className="text-[11px] text-slate-400 truncate">
                  Add to Home Screen for native experience
                </p>
              </div>
            </div>
            <button
              onClick={dismissBanner}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
              aria-label="Close install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={promptInstall}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold 
            bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 
            text-white shadow-[0_4px_16px_rgba(147,51,234,0.4)] active:scale-98 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Install Vidi on this Device</span>
          </button>
        </aside>
      )}

      {/* 3. STEP-BY-STEP INSTALL GUIDE MODAL (For iOS Safari or Browsers needing manual 'Add to Home Screen') */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#13141B] border border-purple-500/30 rounded-2xl p-6 shadow-2xl relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              onClick={closeIOSModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 p-2 flex items-center justify-center">
                <img src="/vidi_icon_only.png" alt="Vidi Icon" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 id="modal-title" className="text-base font-bold text-white">
                  Install Vidi on your Device
                </h3>
                <p className="text-xs text-slate-400">
                  Follow these quick steps to add Vidi to your home screen or desktop
                </p>
              </div>
            </div>

            <div className="space-y-3 my-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  1
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    Tap the <strong className="text-white">Share</strong> icon in your browser toolbar
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    Look for <Share className="w-3.5 h-3.5 text-blue-400 inline" /> at the bottom or top bar of Safari/Chrome.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  2
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    Scroll down and choose <strong className="text-white">"Add to Home Screen"</strong>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    Tap <PlusSquare className="w-3.5 h-3.5 text-purple-400 inline" /> <span className="italic">"Add to Home Screen"</span>
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  3
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    Tap <strong className="text-white">Add</strong> in the top right corner
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Vidi will now launch instantly from your screen like a native app.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={closeIOSModal}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_4px_16px_rgba(147,51,234,0.3)]"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
