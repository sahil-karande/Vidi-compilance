/**
 * Vidi — frontend/src/App.jsx
 * Unified Navigation Links Hub with Premium UI Support & Billing Matrix
 */

import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthGuard } from './components/AuthGuard';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import TestAuth from './pages/TestAuth';
import Upload from './pages/Upload';
import Explorer from './pages/Explorer';
import PricingPage from './components/PricingPage'; // <-- Import updated Pricing Page Component
import BackgroundOrbs from './components/BackgroundOrbs';
import PwaInstallPrompt, { PwaNavButton } from './components/PwaInstallPrompt';
import { PwaProvider } from './context/PwaContext';

// Premium Enterprise Navigation Layout
function WorkspaceLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen w-full bg-[#0D0E12] text-slate-200 font-sans flex flex-col antialiased selection:bg-purple-500/20 selection:text-purple-200 relative overflow-x-hidden">
      {/* 3 Big Animated Floating Purple Circles with Intensity Pulses and Fade */}
      <BackgroundOrbs />

      {/* Sleek Enterprise Top Navbar */}
      <nav className="w-full bg-[#0D0E12]/90 backdrop-blur-md border-b border-white/10 px-6 lg:px-10 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2.5 group select-none">
            <img 
              src="/vidi_icon_only.png" 
              alt="Vidi Logo" 
              className="w-7 h-7 rounded-lg object-contain shadow-sm transition-transform group-hover:scale-105" 
            />
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">Vidi</span>
              <span className="text-[10px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono">
                Compliance Hub
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-400">
            <Link
              to="/dashboard"
              className="hover:text-slate-100 hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
              <span>Dashboard</span>
            </Link>
            <Link
              to="/chat"
              className="hover:text-slate-100 hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
              <span>Research Assistant</span>
            </Link>
            <Link
              to="/upload"
              className="hover:text-slate-100 hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
              <span>Document Repository</span>
            </Link>
            <Link
              to="/explorer"
              className="hover:text-slate-100 hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
              <span>Citation Network</span>
            </Link>
            <Link
              to="/pricing"
              className="hover:text-slate-100 hover:bg-white/5 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
              <span>Plans & Limits</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* PWA Quick Install Action Button */}
          <PwaNavButton />

          {/* Active Subscription Badge or Upgrade Action */}
          {user?.role === 'pro' || user?.role === 'enterprise' ? (
            <Link
              to="/settings"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/15 to-emerald-500/15 border border-purple-500/30 hover:border-purple-500/50 text-[11px] font-semibold text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.15)] transition-all"
              title="Click to view subscription details"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[150px]">{user?.planTitle || 'Pro Member'}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 hidden sm:inline">
                Free Tier
              </span>
              <Link
                to="/pricing"
                className="text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)] px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5"
              >
                <span>Upgrade Plan</span>
              </Link>
            </div>
          )}

          <Link
            to="/settings"
            className="text-xs text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-white/5 transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </Link>

          {/* User initials avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="w-6 h-6 rounded-full bg-[#181820] border border-white/10 flex items-center justify-center text-[10px] font-semibold text-slate-300">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <span className="text-xs font-medium text-slate-300 hidden lg:inline max-w-[120px] truncate">
              {user?.name || 'Sahil Karande'}
            </span>
          </div>
        </div>
      </nav>

      {/* Page Body Full Screen with Smooth Page Entrance Animation */}
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PwaProvider>
        <BrowserRouter>
          {/* Global PWA Install Notification Prompt for Desktop & Mobile */}
          <PwaInstallPrompt />

          <Routes>
            {/* Public Routing Interfaces */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Protected SME Workspace Components Wrapped in the premium Layout */}
            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <WorkspaceLayout>
                    <Dashboard />
                  </WorkspaceLayout>
                </AuthGuard>
              }
            />
            <Route
              path="/chat"
              element={
                <AuthGuard>
                  <WorkspaceLayout>
                    <Chat />
                  </WorkspaceLayout>
                </AuthGuard>
              }
            />
            <Route
              path="/explorer"
              element={
                <AuthGuard>
                  <WorkspaceLayout>
                    <Explorer />
                  </WorkspaceLayout>
                </AuthGuard>
              }
            />
            <Route
              path="/upload"
              element={
                <AuthGuard>
                  <WorkspaceLayout>
                    <Upload />
                  </WorkspaceLayout>
                </AuthGuard>
              }
            />
            <Route
              path="/pricing"
              element={
                <AuthGuard>
                  <WorkspaceLayout>
                    {/* Dynamic user prefill contextual hook routing wrapper */}
                    <PricingRoutingWrapper />
                  </WorkspaceLayout>
                </AuthGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthGuard>
                  <WorkspaceLayout>
                    <Settings />
                  </WorkspaceLayout>
                </AuthGuard>
              }
            />
            <Route
              path="/test-auth"
              element={
                <AuthGuard>
                  <TestAuth />
                </AuthGuard>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </PwaProvider>
    </AuthProvider>
  );
}

// Inline component wrapper to pass down global custom hook values cleanly to the static Pricing layout matrix
// Inline component wrapper inside frontend/src/App.jsx
function PricingRoutingWrapper() {
  const { user, syncSandboxRole } = useAuth(); // Destructure the clean state updater hook

  return (
    <PricingPage
      userEmail={user?.email || ''}
      onSelectPlan={(tier) => {
        if (tier === 'pro' && syncSandboxRole) {
          syncSandboxRole('pro'); // Triggers state change across the app
        }
      }}
    />
  );
}