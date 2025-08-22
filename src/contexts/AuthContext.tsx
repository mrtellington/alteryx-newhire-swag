import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  shipping_address?: any;
  invited: boolean;
  order_submitted: boolean;
  auth_user_id?: string;
  created_at: string;
}

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

  const fetchUserProfile = useCallback(async (userId: string, userEmail?: string) => {
    console.log('🔐 AuthContext: Fetching user profile for userId:', userId, 'email:', userEmail);
    
    try {
      // First try to find by auth_user_id
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      // If no result and we have an email, try finding by email and update the auth_user_id
      if (!data && userEmail) {
        console.log('🔐 AuthContext: No record found by auth_user_id, trying by email:', userEmail);
        const { data: emailData, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle();

        if (emailData && !emailError) {
          console.log('🔐 AuthContext: Found user by email, updating auth_user_id');
          // Update the user record with the auth_user_id
          const { data: updatedData, error: updateError } = await supabase
            .from('users')
            .update({ auth_user_id: userId })
            .eq('id', emailData.id)
            .select('*')
            .single();

          if (!updateError && updatedData) {
            data = updatedData;
            error = null;
          }
        }
      }

      if (error) {
        console.error('🔐 AuthContext: Error fetching user profile:', error);
        setUserProfile(null);
        return false;
      } else if (data) {
        console.log('🔐 AuthContext: User profile loaded:', data);
        setUserProfile(data);
        return true;
      } else {
        console.log('🔐 AuthContext: No user profile found for userId:', userId, 'email:', userEmail);
        setUserProfile(null);
        return false;
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
      await fetchUserProfile(session.user.id, session.user.email);
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
          fetchUserProfile(session.user.id, session.user.email);
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
    const isAllowedEmail = allowedDomains.some(domain => email.endsWith(domain)) || email === 'tod.ellington@gmail.com';
    
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

    console.log('🔐 AuthContext: Checking access for user:', user.id, 'email:', user.email);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('invited')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (error) {
        console.log('🔐 AuthContext: Error checking access:', error);
        return false;
      }
      
      if (!data) {
        console.log('🔐 AuthContext: No user record found for auth_user_id:', user.id);
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