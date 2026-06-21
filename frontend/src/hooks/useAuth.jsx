import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email, role, business_profile')
        .eq('user_id', userId)
        .maybeSingle(); // FIX: using maybeSingle() instead of single() so it doesn't crash if empty!

      if (error) {
        console.warn('[RegIQ Auth] Profile missing or not found:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[RegIQ Auth] Unexpected profile fetch error:', err);
      return null;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const userProfile = await fetchProfile(initialSession.user.id);
          setProfile(userProfile || { role: 'free' }); // Fallback defaults
        }
      } catch (err) {
        console.error('[RegIQ Auth] Initialization crash:', err);
      } finally {
        setLoading(false); // CRITICAL: This MUST run to release the "Verifying Session..." screen!
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setLoading(true); // Re-enter safe loading block on state transitions
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const userProfile = await fetchProfile(currentSession.user.id);
        setProfile(userProfile || { role: 'free' });
      } else {
        setProfile(null);
      }
      setLoading(false); // Release lock
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
    isAuthenticated: !!session
  };

 // ... rest of your useAuth.jsx code remains completely untouched ...

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* eslint-disable-next-line react-refresh/only-export-components */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be executed within an explicit <AuthProvider> wrapper block.');
  }
  return context;
}