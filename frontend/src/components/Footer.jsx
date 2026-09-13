/**
 * Vidi — frontend/src/components/Footer.jsx
 * Prominent, dark minimalist footer with enlarged proportions, Privacy & Terms and Condition modals
 */

import React, { useState } from 'react';
import { X, Shield, FileText } from 'lucide-react';

export default function Footer({ className = '' }) {
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null

  return (
    <>
      <footer className={`w-full border-t border-white/10 px-6 sm:px-12 lg:px-20 py-10 sm:py-12 flex flex-col md:flex-row items-center justify-between gap-6 bg-black text-slate-300 select-none ${className}`}>
        {/* Left: Brand with enlarged logo and typography */}
        <div className="flex items-center gap-3">
          <img 
            src="/vidi_icon_only.png" 
            alt="Vidi Logo" 
            className="w-8 h-8 rounded-lg object-contain shadow-md" 
          />
          <span className="font-bold text-white text-lg sm:text-xl tracking-tight">Vidi</span>
        </div>

        {/* Center: Enlarged Tagline */}
        <div className="text-center text-sm sm:text-base text-slate-300 font-medium tracking-wide">
          © 2026 — Built with blood & sweat by warriors who code under pressure.
        </div>

        {/* Right: Enlarged Navigation Links (Privacy and Terms and Condition) */}
        <div className="flex items-center gap-8 sm:gap-10 text-sm sm:text-base font-medium text-slate-300">
          <button 
            onClick={() => setActiveModal('privacy')}
            className="hover:text-white transition-colors cursor-pointer focus:outline-none"
          >
            Privacy
          </button>
          <button 
            onClick={() => setActiveModal('terms')}
            className="hover:text-white transition-colors cursor-pointer focus:outline-none"
          >
            Terms and Condition
          </button>
        </div>
      </footer>

      {/* Interactive Modal Dialog for Privacy & Terms and Condition */}
      {activeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="w-full max-w-xl bg-[#111218] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative text-slate-300"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Privacy Policy Modal */}
            {activeModal === 'privacy' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Privacy Policy</h3>
                    <p className="text-xs text-slate-400">Last updated: January 2026</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                  <p>
                    At <strong className="text-white">Vidi</strong>, we protect confidential financial, legal, and tax data with enterprise-grade safeguards.
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">1. Data Isolation & Security</h4>
                    <p>
                      All compliance documents uploaded to Vidi are encrypted at rest using AES-256 and in transit via TLS 1.3. Multi-tenant database separation is enforced via Supabase Row-Level Security (RLS).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">2. No Model Training on Client Data</h4>
                    <p>
                      Your uploaded statutory filings, GST returns, and corporate agreements are never used to train public or foundational LLM weights.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">3. Indian Regulatory DPDP Compliance</h4>
                    <p>
                      We comply with the Digital Personal Data Protection (DPDP) Act 2023 and standard financial data retention policies across Indian jurisdictions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Terms and Condition Modal */}
            {activeModal === 'terms' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Terms and Condition</h3>
                    <p className="text-xs text-slate-400">Effective from: 2026</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                  <p>
                    By accessing or using <strong className="text-white">Vidi</strong>, you agree to the following terms and conditions:
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">1. Informational & Research Purpose</h4>
                    <p>
                      Vidi provides source-grounded compliance intelligence referencing MCA, GST, RBI, and SEBI statutory provisions. AI-generated insights serve as decision support and do not constitute formal legal certification or chartered accountant sign-off.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">2. Statutory Verification</h4>
                    <p>
                      While Vidi validates against authoritative circulars and acts, users remain responsible for formal statutory filings with respective ministry portals.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">3. Acceptable Use</h4>
                    <p>
                      Users agree not to reverse engineer the vector retrieval pipeline or misuse the platform for unlawful activities.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
