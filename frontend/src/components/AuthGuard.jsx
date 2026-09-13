
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 

export function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0E12] text-slate-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500/20 border-t-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.35)]"></div>
            <img src="/vidi_icon_only.png" alt="Vidi" className="w-5 h-5 absolute rounded-sm opacity-80" />
          </div>
          <p className="text-xs text-purple-300/80 font-mono tracking-widest uppercase">Verifying Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}