/**
 * RegIQ — frontend/src/App.jsx
 * Week 6 — Task 31 Integration: Pricing & Settings Module Unified
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx'; 
import { AuthGuard } from './components/AuthGuard';
import Landing from './pages/Landing'; 
import Login from './pages/Login';
import Chat from './pages/Chat'; 
import Settings from './pages/Settings'; // Day 31: Imported productionized Pricing/Settings module
import TestAuth from './pages/TestAuth';

// Day 25 Page Placeholders — remaining to be populated in upcoming build sequences
const DashboardView = () => <div className="p-8 min-h-screen bg-slate-950 text-slate-200"><h2>Compliance Risk Scorecard & Deadlines</h2></div>;
const ExplorerView = () => <div className="p-8 min-h-screen bg-slate-950 text-slate-200"><h2>D3.js Regulation Citation Matrix Graph</h2></div>;
const UploadView = () => <div className="p-8 min-h-screen bg-slate-950 text-slate-200"><h2>Document Ingestion Workspace (Pro Only)</h2></div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Home Route */}
          <Route path="/" element={<Landing />} />
          
          {/* Open Public Authentication Gateway */}
          <Route path="/login" element={<Login />} />
          
          {/* Secure Protected Core SaaS Shell Modules */}
          <Route 
            path="/dashboard" 
            element={<AuthGuard><DashboardView /></AuthGuard>} 
          />
          <Route 
            path="/chat" 
            element={<AuthGuard><Chat /></AuthGuard>} 
          />
          <Route 
            path="/explorer" 
            element={<AuthGuard><ExplorerView /></AuthGuard>} 
          />
          <Route 
            path="/upload" 
            element={<AuthGuard><UploadView /></AuthGuard>} 
          />
          
          {/* Day 31: Linked directly to your 4-tier upgrade workspace flow */}
          <Route 
            path="/settings" 
            element={<AuthGuard><Settings /></AuthGuard>} 
          />

          {/* Validation Tool Vectors */}
          <Route 
            path="/test-auth" 
            element={<AuthGuard><TestAuth /></AuthGuard>} 
          />

          {/* Catch-all Wildcard Route Safeguard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}