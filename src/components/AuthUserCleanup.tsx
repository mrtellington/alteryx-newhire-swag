import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AuthUserCleanup() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<any>(null);

  const triggerCleanup = async () => {
    setIsLoading(true);
    try {
      console.log('Triggering auth user cleanup...');
      
      const { data, error } = await supabase.functions.invoke('cleanup-auth-users', {
        body: {}
      });

      if (error) {
        console.error('Cleanup error:', error);
        toast.error(`Cleanup failed: ${error.message}`);
        return;
      }

      console.log('Cleanup result:', data);
      setLastCleanup(data);
      
      toast.success(`Cleanup completed! Deleted ${data.totalDeleted} unauthorized users.`);
      
    } catch (error: any) {
      console.error('Error triggering cleanup:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth User Cleanup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Remove unauthorized users from the authentication system. This will delete any auth users who are not active admins or invited users who haven't ordered.
        </p>
        
        <Button 
          onClick={triggerCleanup} 
          disabled={isLoading}
          variant="destructive"
        >
          {isLoading ? 'Cleaning up...' : 'Cleanup Auth Users'}
        </Button>
        
        {lastCleanup && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <h4 className="font-medium">Last Cleanup Result:</h4>
            <p className="text-sm">Total deleted: {lastCleanup.totalDeleted}</p>
            {lastCleanup.deletedUsers && lastCleanup.deletedUsers.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Deleted users:</p>
                <ul className="text-xs space-y-1">
                  {lastCleanup.deletedUsers.map((user: any, index: number) => (
                    <li key={index} className="text-muted-foreground">
                      {user.email}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}