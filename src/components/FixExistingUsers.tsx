import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const FixExistingUsers = () => {
  const [fixing, setFixing] = useState(false);

  const fixExistingUsers = async () => {
    setFixing(true);
    
    const usersToFix = [
      {
        email: 'christian.houston@whitestonebranding.com',
        full_name: 'Christian Houston',
        first_name: 'Christian',
        last_name: 'Houston'
      },
      {
        email: 'tejal.makuck@whitestonebranding.com',
        full_name: 'Tejal Makuck',
        first_name: 'Tejal',
        last_name: 'Makuck'
      }
    ];

    let results = [];
    
    for (const user of usersToFix) {
      try {
        console.log(`Running webhook for: ${user.email}`);
        
        const { data, error } = await supabase.functions.invoke('cognito-webhook', {
          body: user
        });

        if (error) {
          console.error(`Error for ${user.email}:`, error);
          results.push(`❌ ${user.email}: ${error.message}`);
        } else {
          console.log(`Success for ${user.email}:`, data);
          results.push(`✅ ${user.email}: ${data.canLogin ? 'Can login' : 'Auth setup incomplete'}`);
        }
      } catch (err) {
        console.error(`Exception for ${user.email}:`, err);
        results.push(`❌ ${user.email}: Exception occurred`);
      }
    }

    toast.success(`Results:\n${results.join('\n')}`);
    setFixing(false);
  };

  return (
    <div className="p-4 border rounded-lg bg-yellow-50">
      <h3 className="text-lg font-semibold mb-2">One-time Fix for Existing Users</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This will create auth accounts for Christian and Tejal so they can login. 
        Remove this component after running once.
      </p>
      <Button onClick={fixExistingUsers} disabled={fixing} variant="outline">
        {fixing ? 'Processing...' : 'Fix Christian & Tejal Auth'}
      </Button>
    </div>
  );
};