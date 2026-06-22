/**
 * Vidi — frontend/src/App.jsx
 * Day 23 Verification: Integrated Real-Time Persistent Chat Route Configuration
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx'; 
import Login from './pages/Login';
import { AuthGuard } from './components/AuthGuard';
import Chat from './pages/Chat'; // Your real Chat component file

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root Redirect to primary workspace module */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Open Public Routing Block */}
          <Route path="/login" element={<Login />} />
          
          {/* Secure Protected Core System Modules */}
          <Route 
            path="/dashboard" 
            element={
              <AuthGuard>
                {/* We completely swapped DashboardPlaceholder out for your real Chat UI here */}
                <Chat />
              </AuthGuard>
            } 
          />

          {/* Catch-all Fallback Strategy */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}