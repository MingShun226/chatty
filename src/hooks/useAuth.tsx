
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);

  // Fetch account status from profiles
  const fetchAccountStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setAccountStatus(data.account_status);
      }
    } catch (err) {
      console.warn('[Auth] Failed to fetch account status:', err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed successfully');
        }

        if (event === 'SIGNED_OUT') {
          console.log('[Auth] User signed out');
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Fetch account status when user is set
        if (session?.user) {
          fetchAccountStatus(session.user.id);
        } else {
          setAccountStatus(null);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('[Auth] Session error, clearing invalid tokens:', error.message);
        // Clear invalid tokens
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') && key.includes('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
        setSession(null);
        setUser(null);
        setAccountStatus(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);

        // Fetch account status when user is set
        if (session?.user) {
          fetchAccountStatus(session.user.id);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.warn('[Auth] Failed to get session:', err);
      setSession(null);
      setUser(null);
      setAccountStatus(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string, phone?: string, referrerCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      phone: phone, // Save phone to auth.users table
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name,
          full_name: name,
          phone: phone,
          referrer_code: referrerCode
        }
      }
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    // Update last_login timestamp after successful login
    if (data?.user && !error) {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);
    }

    return { data, error };
  };

  const signOut = async () => {
    try {
      // Clear localStorage directly to avoid 403 errors
      // This is safer than calling the API when session might be expired
      localStorage.removeItem(`sb-${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`);

      // Also try the standard Supabase auth keys
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });

      // Clear session state
      setSession(null);
      setUser(null);

      // Reload the page to trigger redirect to /auth
      window.location.href = '/auth';

      return { error: null };
    } catch (err) {
      console.warn('Logout exception:', err);
      // Clear state even on exception
      setSession(null);
      setUser(null);
      // Still redirect on error
      window.location.href = '/auth';
      return { error: null };
    }
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    return { error };
  };

  return {
    user,
    session,
    loading,
    accountStatus,
    signUp,
    signIn,
    signOut,
    resetPassword
  };
};
