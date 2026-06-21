import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AuthGuard from './components/AuthGuard';

// Temporary developer layout blocks for visualization
const DashboardPlaceholder = () => (
  <div className="p-8 bg-slate-900 text-white min-h-screen">
    <h1 className="text-2xl font-bold">Dashboard Workspace</h1>
    <p className="text-slate-400">Risk scorecards and timelines live here.</p>
  </div>
);

const ChatPlaceholder = () => (
  <div className="p-8 bg-slate-900 text-white min-h-screen">
    <h1 className="text-2xl font-bold">RAG Chat Workspace</h1>
    <p className="text-slate-400">Contextual legal compliance Q&A engine interface.</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Open Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Secure Protected Core System Modules */}
        <Route 
          path="/dashboard" 
          element={
            <AuthGuard>
              <DashboardPlaceholder />
            </AuthGuard>
          } 
        />
        
        <Route 
          path="/chat" 
          element={
            <AuthGuard>
              <ChatPlaceholder />
            </AuthGuard>
          } 
        />

        {/* Catch-all Routing Strategy */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}