import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ShieldCheck, Sparkles, ArrowRight, ArrowLeft, Mail, KeyRound } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      }
    });
  }, [navigate, location]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return setError('Please enter a valid email address.');
    
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setIsOtpSent(true);
      setMessage('A 6-digit one-time password has been dispatched to your email.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return setError('Please enter the OTP sent to your email.');

    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (error) {
      setError(error.message);
    } else if (data.session) {
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#030712] text-slate-200 px-4 sm:px-6 relative overflow-hidden font-sans">
      
      {/* Ambient Glow Orbs */}
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Return to Home link */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors z-20"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Home
      </button>

      {/* Login Card */}
      <div className="max-w-md w-full space-y-6 bg-slate-900/60 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-slate-800/80 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-lg mx-auto shadow-[0_0_20px_rgba(56,189,248,0.4)]">
            V
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Access RegIQ Matrix</h2>
          <p className="text-xs text-slate-400">
            Sign in to your SME compliance workspace.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-500/40 p-3 text-xs text-red-300 rounded-xl leading-relaxed">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-950/50 border border-emerald-500/40 p-3 text-xs text-emerald-300 rounded-xl leading-relaxed">
            {message}
          </div>
        )}

        {/* Primary Action: Google OAuth */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-700/80 rounded-2xl shadow-sm bg-slate-950/60 hover:bg-slate-800/80 text-xs font-bold text-slate-200 hover:text-white transition-all disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.97 1 12 1 7.35 1 3.4 3.65 1.44 7.5l3.77 2.92C6.1 7.37 8.83 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.45 12.27c0-.82-.07-1.6-.2-2.37H12v4.51h6.42c-.27 1.44-1.09 2.66-2.32 3.49l3.6 2.79c2.1-1.94 3.75-4.8 3.75-8.43z" />
              <path fill="#FBBC05" d="M5.21 14.58c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.44 7.5C.52 9.35 0 11.42 0 13.6s.52 4.25 1.44 6.1l3.77-2.92z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.6-2.79c-1.2.8-2.73 1.28-4.36 1.28-3.17 0-5.9-2.33-6.86-5.38L1.37 16.1C3.33 19.93 7.28 23 12 23z" />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[10px] uppercase text-slate-500 font-mono font-bold tracking-widest">
              or use OTP
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Email OTP Authentication */}
          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              <div>
                <label htmlFor="email" className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-bold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Business Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>Send One-Time Code</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div>
                <label htmlFor="otp" className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" /> 6-Digit Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full tracking-widest text-center px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-base text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="w-1/3 py-3 px-3 rounded-2xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 px-4 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all disabled:opacity-50"
                >
                  Verify & Enter
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-500 font-mono">
            Protected by Supabase Auth with Row-Level Tenant Isolation.
          </p>
        </div>

      </div>
    </div>
  );
}