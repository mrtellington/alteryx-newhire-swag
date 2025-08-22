import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AdminRole = 'admin' | 'view_only' | 'none';

export const useAdminRole = () => {
  const [role, setRole] = useState<AdminRole>('none');
  const [loading, setLoading] = useState(true);

  const fetchAdminRole = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_role');
      if (error) {
        console.error('Error fetching admin role:', error);
        setRole('none');
      } else {
        setRole((data as AdminRole) || 'none');
      }
    } catch (error) {
      console.error('Error fetching admin role:', error);
      setRole('none');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminRole();
  }, []);

  const isAdmin = role === 'admin';
  const isViewOnly = role === 'view_only';
  const hasAdminAccess = role === 'admin' || role === 'view_only';

  return {
    role,
    loading,
    isAdmin,
    isViewOnly,
    hasAdminAccess,
    refetch: fetchAdminRole
  };
};