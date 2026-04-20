import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchUserProfile(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchUserProfile(session.user);
      else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // SECURITY: Always fail closed — if we cannot verify the role, sign out.
  // Never grant an elevated role on error.
  const fetchUserProfile = async (authUser) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        console.error('Could not verify user profile/role. Signing out for security.', error);
        await supabase.auth.signOut();
        setUser(null);
        return null;
      }

      const enriched = { ...authUser, ...data };
      setUser(enriched);
      return enriched;
    } catch (err) {
      console.error('Unexpected error fetching user profile:', err);
      await supabase.auth.signOut();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    // No mock bypass. No hardcoded credentials. All logins go through Supabase Auth.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // fetchUserProfile returns the enriched profile so callers can make
    // immediate routing decisions (e.g. redirect to /reset-password)
    // without waiting for a React re-render cycle.
    const profile = await fetchUserProfile(data.user);
    return { success: true, user: profile };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const checkFirstLogin = (userObj) => {
    return userObj?.must_change_password === true;
  };



  // Update the authenticated user's password in Supabase Auth and clear the
  // must_change_password flag via the regular anon client (RLS allows own-row updates).
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    const userId = data?.user?.id || user?.id;
    if (userId) {
      await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', userId);

      setUser(prev => prev ? { ...prev, must_change_password: false } : prev);
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      user,
      signIn,
      signOut,
      checkFirstLogin,
      updatePassword,
      loading
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
