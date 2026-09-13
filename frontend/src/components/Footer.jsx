/**
 * Vidi — frontend/src/components/Footer.jsx
 * Sleek, dark minimalist footer matching the NodeClash style with Privacy, Terms, and Contact modals
 */

import React, { useState } from 'react';
import { X, Mail, Shield, FileText, Check, Copy } from 'lucide-react';

export default function Footer({ className = '' }) {
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | 'contact' | null
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('support@vidi.ai');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <>
      <footer className={`w-full border-t border-white/10 px-6 sm:px-12 lg:px-20 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs bg-black text-slate-400 select-none ${className}`}>
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <img 
            src="/vidi_icon_only.png" 
            alt="Vidi Logo" 
            className="w-5 h-5 rounded object-contain" 
          />
          <span className="font-bold text-white text-sm tracking-tight">Vidi</span>
        </div>

        {/* Center: Tagline */}
        <div className="text-center text-xs text-slate-400">
          © 2026 — Built with blood & sweat by warriors who code under pressure.
        </div>

        {/* Right: Navigation Links */}
        <div className="flex items-center gap-6 sm:gap-8 text-xs text-slate-400">
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
            Terms
          </button>
          <button 
            onClick={() => setActiveModal('contact')}
            className="hover:text-white transition-colors cursor-pointer focus:outline-none"
          >
            Contact
          </button>
        </div>
      </footer>

      {/* Interactive Modal Dialog for Privacy, Terms & Contact */}
      {activeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="w-full max-w-lg bg-[#111218] border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl relative text-slate-300"
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
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Privacy Policy</h3>
                    <p className="text-xs text-slate-400">Last updated: January 2026</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
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

            {/* Terms of Service Modal */}
            {activeModal === 'terms' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Terms of Service</h3>
                    <p className="text-xs text-slate-400">Effective from: 2026</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                  <p>
                    By accessing or using <strong className="text-white">Vidi</strong>, you agree to the following terms:
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

            {/* Contact Modal */}
            {activeModal === 'contact' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Contact & Support</h3>
                    <p className="text-xs text-slate-400">We're here to assist your compliance team</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    Have questions about enterprise compliance, custom regulatory feeds, or platform feedback? Reach out directly:
                  </p>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-purple-400" />
                      <span className="font-mono text-white text-xs font-semibold">support@vidi.ai</span>
                    </div>
                    <button
                      onClick={handleCopyEmail}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-slate-400 text-[11px]">Enterprise Legal Inquiries</div>
                    <div className="text-white text-xs font-medium">regulatory-desk@vidi.ai</div>
                    <div className="text-slate-400 text-[11px] pt-1">Response time: within 24 hours on Indian statutory business days.</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
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
