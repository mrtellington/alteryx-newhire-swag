import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, User } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkUserAccess: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    console.log('🔐 AuthContext: Fetching user profile for:', userId);
    
    try {
      // Try direct query with auth_user_id and timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      clearTimeout(timeoutId);

      console.log('🔐 AuthContext: Query result:', { data, error });

      if (error) {
        console.error('🔐 AuthContext: Error fetching user profile:', error);
        setUserProfile(null);
        return false;
      } else {
        console.log('🔐 AuthContext: User profile loaded:', data);
        setUserProfile(data);
        return true;
      }
    } catch (error) {
      console.error('🔐 AuthContext: Error fetching user profile:', error);
      setUserProfile(null);
      return false;
    }
  }, []);

  const handleAuthChange = useCallback(async (event: string, session: any) => {
    console.log('🔐 AuthContext: Auth state changed:', event, session ? 'User logged in' : 'No session');
    
    setUser(session?.user ?? null);
    
    if (session?.user) {
      await fetchUserProfile(session.user.id);
    } else {
      setUserProfile(null);
    }
    
    setLoading(false);
  }, [fetchUserProfile]);

  useEffect(() => {
    console.log('🔐 AuthContext: Setting up auth listener...');
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('🔐 AuthContext: Error getting initial session:', error);
        setLoading(false);
        return;
      }

      console.log('🔐 AuthContext: Initial session check:', session ? 'User logged in' : 'No session');
      
      // Only set user if we don't already have one (to avoid race conditions)
      if (!user) {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchUserProfile(session.user.id);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthChange, fetchUserProfile, user]);

  const signIn = async (email: string) => {
    console.log('🔐 AuthContext: Attempting sign in with:', email);
    
    // Check if email is from @alteryx.com domain OR developer emails
    const allowedDomains = ['@alteryx.com', '@whitestonebranding.com'];
    const isAllowedEmail = allowedDomains.some(domain => email.endsWith(domain));
    
    if (!isAllowedEmail) {
      console.log('🔐 AuthContext: Email domain not allowed:', email);
      return { error: { message: 'Only @alteryx.com email addresses are allowed' } };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    console.log('🔐 AuthContext: Sign in result:', error ? 'Error' : 'Success');
    return { error };
  };

  const signOut = async () => {
    console.log('🔐 AuthContext: Signing out...');
    await supabase.auth.signOut();
  };

  const checkUserAccess = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.log('🔐 AuthContext: No user to check access for');
      return false;
    }

    console.log('🔐 AuthContext: Checking access for user:', user.id);
    try {
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.error('🔐 AuthContext: Access check timeout');
      }, 10000);

      const { data, error } = await supabase
        .from('users')
        .select('invited')
        .eq('auth_user_id', user.id)
        .single();

      clearTimeout(timeoutId);

      if (error || !data) {
        console.log('🔐 AuthContext: Error checking access:', error);
        return false;
      }
      
      console.log('🔐 AuthContext: Access check result:', data.invited);
      return data.invited;
    } catch (error) {
      console.error('🔐 AuthContext: Error checking user access:', error);
      return false;
    }
  }, [user]);

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signOut,
    checkUserAccess,
  };

  console.log('🔐 AuthContext: Current state:', { 
    user: user ? 'Logged in' : 'Not logged in', 
    loading, 
    userProfile: userProfile ? 'Loaded' : 'Not loaded'
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
