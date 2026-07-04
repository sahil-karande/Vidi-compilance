/**
 * Vidi — frontend/src/App.jsx
 * Week 6 — Task 31 Integration: Pricing & Settings Module Unified
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth'; 
import { AuthGuard } from './components/AuthGuard';
import Landing from './pages/Landing'; 
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat'; 
import Settings from './pages/Settings'; 
import TestAuth from './pages/TestAuth';

// Day 25 Page Placeholders — ready for future build sequences
const ExplorerView = () => (
  <div className="p-8 min-h-screen bg-slate-950 text-slate-200 font-sans">
    <h2 className="text-xl font-bold tracking-tight text-indigo-400">Vidi Regulation Explorer</h2>
    <p className="text-xs text-slate-400 mt-1">D3.js dynamic structural force graph mapping cross-regulatory circular citations.</p>
  </div>
);

const UploadView = () => (
  <div className="p-8 min-h-screen bg-slate-950 text-slate-200 font-sans">
    <h2 className="text-xl font-bold tracking-tight text-cyan-400">Document Ingestion Workspace</h2>
    <p className="text-xs text-slate-400 mt-1">Blend your company notices with official corpora using localized vector parsing (Pro feature).</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Interface */}
          <Route path="/" element={<Landing />} />
          
          {/* Public Authentication Gateway */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected SME Workspace Components */}
          <Route 
            path="/dashboard" 
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <AuthGuard>
                <Chat />
              </AuthGuard>
            } 
          />
          <Route 
            path="/explorer" 
            element={
              <AuthGuard>
                <ExplorerView />
              </AuthGuard>
            } 
          />
          <Route 
            path="/upload" 
            element={
              <AuthGuard>
                <UploadView />
              </AuthGuard>
            } 
          />
          
          {/* Account Subscriptions & Tier Matrices */}
          <Route 
            path="/settings" 
            element={
              <AuthGuard>
                <Settings />
              </AuthGuard>
            } 
          />

          {/* Validation Diagnostics */}
          <Route 
            path="/test-auth" 
            element={
              <AuthGuard>
                <TestAuth />
              </AuthGuard>
            } 
          />

          {/* Fallback Guardrail Routing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}