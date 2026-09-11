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
        .maybeSingle();

      if (error) {
        console.warn('[Vidi Auth] Profile database linkage matching skipped:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[Vidi Auth] Unexpected profile fetch exception:', err);
      return null;
    }
  };

  // 💡 FUNCTION TO FORCE A REAL REACT STATE UPDATE FOR THE SANDBOX
  const syncSandboxRole = (newRole) => {
    sessionStorage.setItem("regiq_sandbox_role", newRole);
    if (user) {
      setUser((prev) => (prev ? { ...prev, role: newRole } : null));
    }
    if (profile) {
      setProfile((prev) => (prev ? { ...prev, role: newRole } : null));
    }
    console.log(`[Vidi Auth] Global state role synchronized reactively to: ${newRole}`);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        
        if (initialSession?.user) {
          const userProfile = await fetchProfile(initialSession.user.id);
          
          const sandboxOverride = sessionStorage.getItem("regiq_sandbox_role");
          const activeRole = sandboxOverride || userProfile?.role || 'free';
          
          const activeProfile = userProfile ? { ...userProfile, role: activeRole } : { role: activeRole };
          setProfile(activeProfile);
          
          const resolveName = (profile, authUser) => {
            if (profile?.name && profile.name !== 'Sahi') return profile.name;
            if (authUser.user_metadata?.full_name) return authUser.user_metadata.full_name;
            if (authUser.email?.includes('sahil')) return 'Sahil Karande';
            return 'Sahil Karande';
          };

          setUser({
            ...initialSession.user,
            name: resolveName(userProfile, initialSession.user),
            role: activeRole,
            business_profile: userProfile?.business_profile || null
          });
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('[Vidi Auth] Lifecycle initiation error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setLoading(true);
      setSession(currentSession);

      if (currentSession?.user) {
        const userProfile = await fetchProfile(currentSession.user.id);
        
        const sandboxOverride = sessionStorage.getItem("regiq_sandbox_role");
        const activeRole = sandboxOverride || userProfile?.role || 'free';

        const activeProfile = userProfile ? { ...userProfile, role: activeRole } : { role: activeRole };
        setProfile(activeProfile);
        
        const resolveName = (profile, authUser) => {
          if (profile?.name && profile.name !== 'Sahi') return profile.name;
          if (authUser.user_metadata?.full_name) return authUser.user_metadata.full_name;
          if (authUser.email?.includes('sahil')) return 'Sahil Karande';
          return 'Sahil Karande';
        };

        setUser({
          ...currentSession.user,
          name: resolveName(userProfile, currentSession.user),
          role: activeRole,
          business_profile: userProfile?.business_profile || null
        });
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      sessionStorage.removeItem("regiq_sandbox_role");
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Vidi Auth] Signout pipeline failure:', err);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const refreshUserSession = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const userProfile = await fetchProfile(currentSession.user.id);
        const sandboxOverride = sessionStorage.getItem("regiq_sandbox_role");
        const activeRole = sandboxOverride || userProfile?.role || 'free';
        const activeProfile = userProfile ? { ...userProfile, role: activeRole } : { role: activeRole };
        setProfile(activeProfile);

        const displayName = (userProfile?.name && userProfile.name !== 'Sahi') 
          ? userProfile.name 
          : (currentSession.user.user_metadata?.full_name || 'Sahil Karande');

        setUser({
          ...currentSession.user,
          name: displayName,
          role: activeRole,
          business_profile: userProfile?.business_profile || null
        });
      }
    } catch (err) {
      console.error('[Vidi Auth] Failed to refresh session:', err);
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const activeId = user?.id || currentSession?.user?.id;
      if (!activeId) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: activeId,
          email: user?.email || currentSession?.user?.email,
          ...updates,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      await refreshUserSession();
    } catch (err) {
      console.error('[Vidi Auth] Error updating user profile:', err);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
    syncSandboxRole,
    refreshUserSession,
    updateUserProfile,
    isAuthenticated: !!session
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be executed within an explicit <AuthProvider> wrapper block.');
  }
  return context;
}