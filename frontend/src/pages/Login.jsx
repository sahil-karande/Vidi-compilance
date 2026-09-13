import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { ShieldCheck, ArrowRight, ArrowLeft, Mail, KeyRound, CheckCircle2 } from 'lucide-react';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      }
    });

    return () => subscription?.unsubscribe();
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
    if (!email) return setError('Please enter a valid business email address.');
    
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setIsOtpSent(true);
      setMessage('A 6-digit code has been dispatched. Enter the code below or click the sign-in link in your email.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return setError('Please enter the 6-digit OTP sent to your email.');

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
    <div className="min-h-screen w-full bg-[#0D0E12] text-slate-200 font-sans flex flex-col antialiased selection:bg-purple-500/20 selection:text-purple-200 overflow-x-hidden relative">
      
      {/* ── 3 Big Animated Floating Purple Circles with Intensity Pulses & Fade ── */}
      <BackgroundOrbs />

      {/* ── Subtle Geometric Grid Texture ── */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* ── Top Navigation Bar matching Landing.jsx ── */}
      <header className="w-full border-b border-white/10 bg-[#0D0E12]/80 backdrop-blur-md px-6 sm:px-12 lg:px-20 py-4 flex items-center justify-between sticky top-0 z-50">
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <img 
            src="/vidi_icon_only.png" 
            alt="Vidi Logo" 
            className="w-8 h-8 rounded-lg object-contain shadow-md transition-transform group-hover:scale-105" 
          />
          <span className="text-xl font-bold tracking-tight text-white">Vidi</span>
        </div>

        <button 
          onClick={() => navigate('/')} 
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white px-4 py-2 rounded-lg bg-[#181820] border border-white/10 hover:border-white/20 hover:bg-[#20202c] transition-all duration-200 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
          <span>Back to Home</span>
        </button>
      </header>

      {/* ── Main Authentication Area ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 relative z-10 w-full max-w-md mx-auto">
        
        {/* Release Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#181820] border border-white/10 text-slate-300 text-xs font-medium mb-6 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-slate-400 font-normal">SME Compliance Matrix</span>
          <span className="text-slate-600">•</span>
          <span className="text-purple-300 font-semibold">Secure Workspace</span>
        </div>

        {/* Auth Glass Card */}
        <div className="w-full bg-[#12131A]/90 backdrop-blur-2xl p-8 sm:p-10 rounded-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] hover:border-purple-500/30 transition-all duration-300 space-y-6">
          
          {/* Card Header */}
          <div className="text-center space-y-2">
            <img 
              src="/vidi_icon_only.png" 
              alt="Vidi Logo" 
              className="w-12 h-12 rounded-xl object-contain mx-auto shadow-lg mb-3" 
            />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Access Vidi Matrix
            </h1>
            <p className="text-xs text-slate-400">
              Sign in to your Indian SME compliance workspace.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-950/40 border border-red-500/40 p-3.5 text-xs text-red-300 rounded-xl leading-relaxed">
              {error}
            </div>
          )}

          {/* Success / OTP Dispatched Banner */}
          {message && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-3.5 text-xs text-emerald-300 rounded-xl leading-relaxed flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-white/10 rounded-xl shadow-sm bg-[#181820] hover:bg-[#20202c] hover:border-white/20 text-xs font-semibold text-white transition-all duration-200 disabled:opacity-50"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.97 1 12 1 7.35 1 3.4 3.65 1.44 7.5l3.77 2.92C6.1 7.37 8.83 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.45 12.27c0-.82-.07-1.6-.2-2.37H12v4.51h6.42c-.27 1.44-1.09 2.66-2.32 3.49l3.6 2.79c2.1-1.94 3.75-4.8 3.75-8.43z" />
              <path fill="#FBBC05" d="M5.21 14.58c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.44 7.5C.52 9.35 0 11.42 0 13.6s.52 4.25 1.44 6.1l3.77-2.92z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.6-2.79c-1.2.8-2.73 1.28-4.36 1.28-3.17 0-5.9-2.33-6.86-5.38L1.37 16.1C3.33 19.93 7.28 23 12 23z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex py-1.5 items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-[11px] uppercase text-slate-500 font-medium tracking-wider">
              or use OTP
            </span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {/* Email OTP Authentication Form */}
          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  <span>Business Email Address</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#181820] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:shadow-[0_0_28px_rgba(168,85,247,0.5)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? 'Sending code...' : 'Send One-Time Code'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-purple-200" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                  <span>6-Digit Verification Code</span>
                </label>
                <input
                  id="otp"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full tracking-[0.4em] text-center px-4 py-3 bg-[#181820] border border-white/10 rounded-xl text-lg text-purple-300 font-mono font-bold focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="w-1/3 py-3 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181820] hover:bg-[#20202c] border border-white/10 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:shadow-[0_0_28px_rgba(168,85,247,0.5)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? 'Verifying...' : 'Verify & Enter'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-200" />
                </button>
              </div>
            </form>
          )}

          {/* Security Footnote */}
          <div className="text-center pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Protected by Supabase Auth with Row-Level Tenant Isolation</span>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 relative z-10">
        <p>© 2026 Vidi. Source-grounded financial compliance assistant for Indian SMEs.</p>
      </footer>

    </div>
  );
}