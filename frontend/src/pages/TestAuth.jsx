/**
 * Vidi — frontend/src/pages/TestAuth.jsx
 * Day 19 Task: Browser test page for Google OAuth flow
 *
 * TEMPORARY test page — verifies useAuth.js works end-to-end.
 * Add a route for this in App.jsx: <Route path="/test-auth" element={<TestAuth />} />
 * Visit http://localhost:5173/test-auth to test login.
 *
 * Delete this file once Login.jsx (Day 22) replaces it.
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function TestAuth() {
  const {
    user,
    profile,
    loading,
    isAuthenticated,
    role,
    signInWithGoogle,
    signInWithOtp,
    signOut,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      // Browser redirects to Google — this code won't continue here
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

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading session...</div>;
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 500 }}>
      <h1>Vidi — Day 19 Auth Test</h1>

      {error && (
        <div style={{ background: '#fee', color: '#c00', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {isAuthenticated ? (
        <div>
          <h2>✅ Signed In</h2>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 12 }}>
{JSON.stringify({
  user_id: user?.id,
  email: user?.email,
  role: role,
  profile: profile,
}, null, 2)}
          </pre>
          <button onClick={handleSignOut} style={{ padding: '8px 16px', marginTop: 12 }}>
            Sign Out
          </button>
        </div>
      ) : (
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

          <hr style={{ margin: '20px 0' }} />

          <h3>Or use Email OTP:</h3>
          {!otpSent ? (
            <div>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: 8, width: '100%', marginBottom: 8 }}
              />
              <button onClick={handleOtpSignIn} style={{ padding: '8px 16px' }}>
                Send Magic Link
              </button>
            </div>
          ) : (
            <p>✓ Magic link sent to {email}. Check your inbox!</p>
          )}
        </div>
      )}
    </div>
  );
}
