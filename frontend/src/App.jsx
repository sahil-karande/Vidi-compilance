/**
 * Vidi — frontend/src/App.jsx
 * Unified Navigation Links Hub with Premium UI Support & Billing Matrix
 */

import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
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

// Premium Navbar Wrapper Layout
function WorkspaceLayout({ children }) {
  const { user } = useAuth(); // Hook invocation to access session matrix profile context securely

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-200 font-sans flex flex-col antialiased">
      {/* Dynamic Cyber Header */}
      <nav className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 lg:px-12 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-10">
          <Link to="/dashboard" className="text-xl font-black tracking-wider text-white flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-[0_0_15px_rgba(56,189,248,0.4)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.7)] transition-all">
              V
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent font-black">RegIQ</span>
              <span className="text-[10px] text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-md font-mono uppercase tracking-widest bg-cyan-950/40">
                Matrix
              </span>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold tracking-wide text-slate-400">
            <Link to="/dashboard" className="hover:text-white transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-900/60">
              <span>📊</span> Dashboard
            </Link>
            <Link to="/chat" className="hover:text-white transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-900/60">
              <span>💬</span> RAG Chat
            </Link>
            <Link to="/upload" className="hover:text-cyan-400 text-cyan-400/90 font-bold transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-900/60">
              <span>📁</span> Ingestion Upload
            </Link>
            <Link to="/explorer" className="hover:text-white transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-900/60">
              <span>🕸️</span> Citation Explorer
            </Link>
            <Link to="/pricing" className="hover:text-emerald-400 text-slate-400 transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-900/60">
              <span>💳</span> Plans
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user?.role !== 'pro' && user?.role !== 'enterprise' && (
            <Link to="/pricing" className="text-[11px] font-bold bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/40 hover:border-emerald-400 px-3.5 py-1.5 rounded-xl text-emerald-400 hover:text-emerald-300 transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              ⚡ Upgrade Pro
            </Link>
          )}
          <Link to="/settings" className="text-xs bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-xl hover:bg-slate-800 hover:border-slate-700 transition-all text-slate-300 flex items-center gap-1.5">
            ⚙️ Settings
          </Link>
        </div>
      </nav>
      
      {/* Page Body Full Screen */}
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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