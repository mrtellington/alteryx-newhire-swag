import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const DebugAuth: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const getDebugInfo = async () => {
      const info: any = {
        timestamp: new Date().toISOString(),
        user: user ? {
          id: user.id,
          email: user.email,
          created_at: user.created_at
        } : null,
        userProfile,
        loading,
        session: null,
        userRecord: null
      };

      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        info.session = session ? {
          access_token: session.access_token ? 'exists' : 'missing',
          refresh_token: session.refresh_token ? 'exists' : 'missing',
          expires_at: session.expires_at
        } : null;
        info.sessionError = sessionError;

        // Try to fetch user record directly
        if (user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          info.userRecord = userData;
          info.userError = userError;
        }
      } catch (error) {
        info.error = error;
      }

      setDebugInfo(info);
    };

    getDebugInfo();
  }, [user, userProfile, loading]);

  return (
    <div className="p-4 bg-gray-100 border rounded">
      <h3 className="text-lg font-bold mb-2">Debug Info</h3>
      <pre className="text-xs overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
};

export default DebugAuth;
