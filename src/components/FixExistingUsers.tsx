import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const FixExistingUsers = () => {
  const [fixing, setFixing] = useState(false);

  const fixExistingUsers = async () => {
    setFixing(true);
    
    try {
      console.log('Creating auth users for existing users...');
      
      const { data, error } = await supabase.functions.invoke('create-auth-users', {});

      if (error) {
        console.error('Error creating auth users:', error);
        toast.error(`Failed to create auth users: ${error.message}`);
      } else {
        console.log('Auth user creation results:', data);
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const errorCount = data.results?.filter((r: any) => !r.success).length || 0;
        
        toast.success(`Processed ${data.processed} users. ${successCount} successful, ${errorCount} errors.`);
        
        if (errorCount > 0) {
          console.log('Errors:', data.results?.filter((r: any) => !r.success));
        }
      }
    } catch (err) {
      console.error('Exception creating auth users:', err);
      toast.error('Exception occurred while creating auth users');
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-yellow-50">
      <h3 className="text-lg font-semibold mb-2">One-time Fix for Existing Users</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This will create auth accounts for all users missing them so they can login. 
        Remove this component after running once.
      </p>
      <Button onClick={fixExistingUsers} disabled={fixing} variant="outline">
        {fixing ? 'Processing...' : 'Create Missing Auth Users'}
      </Button>
    </div>
  );
};