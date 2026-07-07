/**
 * Vidi — frontend/src/App.jsx
 * Unified Navigation Links Hub with Premium UI Support
 */

import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth'; 
import { AuthGuard } from './components/AuthGuard';
import Landing from './pages/Landing'; 
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat'; 
import Settings from './pages/Settings'; 
import TestAuth from './pages/TestAuth';


// Premium Navbar Wrapper Layout
function WorkspaceLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans flex flex-col">
      {/* Dynamic Cyber Header */}
      <nav className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="text-lg font-black tracking-wider text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">RegIQ</span>
            <span className="text-[9px] text-cyan-400 border border-cyan-400/30 px-1 py-0.2 rounded font-mono uppercase tracking-widest bg-cyan-950/30">Pro Matrix</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-5 text-xs font-semibold tracking-wide text-slate-400">
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/chat" className="hover:text-white transition-colors">RAG Chat</Link>
            <Link to="/upload" className="hover:text-cyan-400 text-cyan-400/90 font-bold transition-colors flex items-center gap-1">
              <span>📁</span> Ingestion Upload
            </Link>
            <Link to="/explorer" className="hover:text-white transition-colors">Citation Explorer</Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/settings" className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-all text-slate-300">
            ⚙️ Settings
          </Link>
        </div>
      </nav>
      
      {/* Page Body */}
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}

const ExplorerView = () => (
  <div className="p-8 min-h-screen bg-slate-950 text-slate-200 font-sans">
    <h2 className="text-xl font-bold tracking-tight text-indigo-400">Vidi Regulation Explorer</h2>
    <p className="text-xs text-slate-400 mt-1">D3.js dynamic structural force graph mapping cross-regulatory circular citations.</p>
  </div>
);

const UploadView = () => (
  <div className="p-8 min-h-screen bg-slate-950 text-slate-200 font-sans">
    <h2 className="text-xl font-bold tracking-tight text-cyan-400">Document Ingestion Workspace</h2>
    <p className="text-xs text-slate-400 mt-1 mb-6">Blend your company notices with official corpora using localized vector parsing.</p>
    
    <div className="max-w-xl w-full border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-900/20 rounded-2xl p-12 text-center transition-all group">
      <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">📥</div>
      <h3 className="text-sm font-bold text-white mb-1">Drag and drop your regulatory compliance PDF</h3>
      <p className="text-xs text-slate-500 mb-6">Maximum asset scale up to 10MB file limitation</p>
      <input type="file" id="fileUpload" className="hidden" accept=".pdf" />
      <button 
        onClick={() => document.getElementById('fileUpload').click()}
        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold py-2.5 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
      >
        Select PDF File
      </button>
    </div>
  </div>
);

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
                  <ExplorerView />
                </WorkspaceLayout>
              </AuthGuard>
            } 
          />
          <Route 
            path="/upload" 
            element={
              <AuthGuard>
                <WorkspaceLayout>
                  <UploadView />
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