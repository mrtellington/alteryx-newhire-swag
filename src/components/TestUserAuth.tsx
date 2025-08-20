import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TestUserAuth = () => {
  const [isFixing, setIsFixing] = useState(false);

  const fixUsersAuth = async () => {
    setIsFixing(true);
    
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

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersToFix) {
      try {
        console.log(`Fixing auth for: ${user.email}`);
        
        const { data, error } = await supabase.functions.invoke('cognito-webhook', {
          body: user
        });

        if (error) {
          console.error(`Error fixing ${user.email}:`, error);
          errorCount++;
        } else {
          console.log(`Fixed ${user.email}:`, data);
          successCount++;
        }
      } catch (err) {
        console.error(`Exception fixing ${user.email}:`, err);
        errorCount++;
      }
    }

    toast.success(`Fixed ${successCount} users. ${errorCount} errors.`);
    setIsFixing(false);
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Fix User Authentication</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This will ensure Christian and Tejal can log in with magic links.
      </p>
      <Button onClick={fixUsersAuth} disabled={isFixing}>
        {isFixing ? 'Fixing...' : 'Fix Auth for Christian & Tejal'}
      </Button>
    </div>
  );
};