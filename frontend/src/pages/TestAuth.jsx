/**
 * Vidi — frontend/src/pages/TestAuth.jsx
 * Day 19 Task: Browser test page for Google OAuth flow
 * Day 23 Patch: Optimized to eliminate ESLint no-unused-vars errors
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Chat from './Chat'; // Import your real Chat component code

export default function TestAuth() {
  const {
    loading,
    isAuthenticated,
    signInWithGoogle,
    signInWithOtp,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOtpSignIn = async () => {
    setError(null);
    try {
      await signInWithOtp(email);
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif', color: 'white' }}>Loading session...</div>;
  }

  // ── Force Override: If signed in, immediately load the Day 23 Chat panel ──
  if (isAuthenticated) {
    return <Chat />;
  }

  // Render the original sign-in interface if there's no active session
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 500, color: 'white' }}>
      <h1 style={{ color: 'white' }}>Vidi — Day 19 Auth Test</h1>

      {error && (
        <div style={{ background: '#fee', color: '#c00', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      <div>
        <h2>Not signed in</h2>

        <button
          onClick={handleGoogleSignIn}
          style={{
            padding: '10px 20px',
            background: '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            marginBottom: 20,
          }}
        >
          Sign in with Google
        </button>

        <hr style={{ margin: '20px 0', borderColor: '#334155' }} />

        <h3>Or use Email OTP:</h3>
        {!otpSent ? (
          <div>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: 8, width: '100%', marginBottom: 8, background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: 4 }}
            />
            <button onClick={handleOtpSignIn} style={{ padding: '8px 16px', cursor: 'pointer' }}>
              Send Magic Link
            </button>
          </div>
        ) : (
          <p>✓ Magic link sent to {email}. Check your inbox!</p>
        )}
      </div>
    </div>
  );
}