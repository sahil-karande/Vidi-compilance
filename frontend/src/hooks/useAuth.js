/**
 * Vidi — frontend/src/hooks/useAuth.js
 * Day 19 Task: Authentication Hook
 *
 * Manages session state across the app:
 * - Tracks current user + session
 * - signInWithGoogle() — triggers Google OAuth flow
 * - signInWithOtp() — email magic link fallback
 * - signOut() — clears session
 * - Fetches user role + business_profile from `profiles` table
 *
 * Usage:
 *   const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);   // role, business_profile from `profiles` table
  const [loading, setLoading] = useState(true);

  // ── Fetch profile row (role + business_profile) for current user ──
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, role, business_profile, created_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[useAuth] Failed to fetch profile:', error.message);
      setProfile(null);
      return;
    }

    setProfile(data);
  }, []);

  // ── Initialize session on mount + listen for auth changes ─────────
  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ── Sign in with Google OAuth ──────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      console.error('[useAuth] Google sign-in failed:', error.message);
      throw error;
    }
  }, []);

  // ── Sign in with Email OTP (magic link fallback) ───────────────────
  const signInWithOtp = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      console.error('[useAuth] OTP sign-in failed:', error.message);
      throw error;
    }
  }, []);

  // ── Verify OTP code (if using 6-digit code instead of magic link) ──
  const verifyOtp = useCallback(async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) {
      console.error('[useAuth] OTP verification failed:', error.message);
      throw error;
    }
  }, []);

  // ── Sign out ────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[useAuth] Sign out failed:', error.message);
      throw error;
    }
    setUser(null);
    setProfile(null);
    setSession(null);
  }, []);

  // ── Refresh profile manually (e.g. after business_profile update) ──
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  return {
    // State
    user,                          // Supabase auth user object (id, email, etc.)
    profile,                       // { user_id, name, email, role, business_profile }
    session,                       // full Supabase session (includes access_token)
    loading,                       // true while checking auth state on mount
    isAuthenticated: !!user,
    role: profile?.role ?? 'guest',

    // Actions
    signInWithGoogle,
    signInWithOtp,
    verifyOtp,
    signOut,
    refreshProfile,
  };
}
