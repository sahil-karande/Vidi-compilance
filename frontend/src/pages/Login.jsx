import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if user is already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      }
    });
  }, [navigate, location]);

  // Handle Google OAuth
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

  // Step 1: Request OTP Email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return setError('Please enter a valid email address.');
    
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // Auto-registers new Indian SME users
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setIsOtpSent(true);
      setMessage('A 6-digit one-time password has been sent to your email.');
    }
    setLoading(false);
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return setError('Please enter the OTP sent to your mail.');

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md border border-slate-100">
        
        {/* Brand Header */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">RegIQ</h2>
          <p className="mt-2 text-sm text-slate-600">
            Financial Regulation Q&A Assistant for Indian SMEs
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 text-sm text-emerald-700 rounded">
            {message}
          </div>
        )}

        {/* Primary Action: Google OAuth */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-lg shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.97 1 12 1 7.35 1 3.4 3.65 1.44 7.5l3.77 2.92C6.1 7.37 8.83 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.45 12.27c0-.82-.07-1.6-.2-2.37H12v4.51h6.42c-.27 1.44-1.09 2.66-2.32 3.49l3.6 2.79c2.1-1.94 3.75-4.8 3.75-8.43z" />
              <path fill="#FBBC05" d="M5.21 14.58c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.44 7.5C.52 9.35 0 11.42 0 13.6s.52 4.25 1.44 6.1l3.77-2.92z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.6-2.79c-1.2.8-2.73 1.28-4.36 1.28-3.17 0-5.9-2.33-6.86-5.38L1.37 16.1C3.33 19.93 7.28 23 12 23z" />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-xs uppercase text-slate-400 font-semibold tracking-wider">
              or use OTP
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Fallback Action: Email OTP Passwordless authentication */}
          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Business Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                Send Magic Code
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <label htmlFor="otp" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  6-Digit Secure Code
                </label>
                <input
                  id="otp"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full tracking-widest text-center px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="w-1/3 py-2 px-3 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-2 px-4 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow transition-colors disabled:opacity-50"
                >
                  Verify & Enter
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}