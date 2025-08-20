import { useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TestUserLogin = () => {
  const [loading, setLoading] = useState(false);

  const testLogin = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/shop`
        }
      });

      if (error) {
        toast.error(`Failed to send magic link to ${email}: ${error.message}`);
      } else {
        toast.success(`Magic link sent to ${email}! Check their email.`);
      }
    } catch (err) {
      toast.error(`Error testing login for ${email}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Test User Login</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Test if all three users can request magic links successfully.
      </p>
      <div className="flex gap-2">
        <Button 
          onClick={() => testLogin('christian.houston@whitestonebranding.com')} 
          disabled={loading}
          size="sm"
        >
          Test Christian
        </Button>
        <Button 
          onClick={() => testLogin('tejal.makuck@whitestonebranding.com')} 
          disabled={loading}
          size="sm"
        >
          Test Tejal
        </Button>
        <Button 
          onClick={() => testLogin('shweta.rathaur@alteryx.com')} 
          disabled={loading}
          size="sm"
        >
          Test Shweta
        </Button>
      </div>
    </div>
  );
};