import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'; // UPDATED: Destructured useAuth here
import Login from './pages/Login';
import { AuthGuard } from './components/AuthGuard';

// Updated developer layout blocks for interactive verification
const DashboardPlaceholder = () => {
  const { signOut, user, profile } = useAuth(); // Extract session data and actions

  return (
    <div className="p-8 bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-6 bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl text-center">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Workspace</h1>
        <p className="text-slate-400 text-sm">
          Risk scorecards and timelines live here.
        </p>
        
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 text-left space-y-2 text-xs">
          <div><span className="text-slate-500 font-medium">User ID:</span> <span className="font-mono text-blue-400">{user?.id || 'Anonymous'}</span></div>
          <div><span className="text-slate-500 font-medium">Email:</span> <span className="font-mono text-slate-300">{user?.email || 'N/A'}</span></div>
          <div><span className="text-slate-500 font-medium">Assigned Role:</span> <span className="uppercase font-bold text-emerald-400">{profile?.role || 'free'}</span></div>
        </div>

        <button 
          onClick={signOut}
          className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          Sign Out Secure Session
        </button>
      </div>
    </div>
  );
};

const ChatPlaceholder = () => (
  <div className="p-8 bg-slate-900 text-white min-h-screen">
    <h1 className="text-2xl font-bold">RAG Chat Workspace</h1>
    <p className="text-slate-400">Contextual legal compliance Q&A engine interface.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}