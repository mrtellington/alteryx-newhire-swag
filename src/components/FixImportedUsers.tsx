import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const FixImportedUsers = () => {
  const [isFixing, setIsFixing] = useState(false);

  const fixUsers = async () => {
    setIsFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-imported-users', {});
      
      if (error) {
        console.error('Error fixing users:', error);
        toast.error('Failed to fix imported users');
        return;
      }

      console.log('Fix results:', data);
      toast.success('Successfully fixed imported users');
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Unexpected error occurred');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Fix Imported Users</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This will create auth users for Christian and Tejal so they can receive magic links and log in.
      </p>
      <Button onClick={fixUsers} disabled={isFixing}>
        {isFixing ? 'Fixing...' : 'Fix Auth Users'}
      </Button>
    </div>
  );
};