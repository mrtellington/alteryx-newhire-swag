import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle } from 'lucide-react';
import { getSessionInfo, updateSessionActivity, clearSecureSession } from '@/lib/security';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SessionTimeoutWarningProps {
  isAdmin?: boolean;
  onSessionExpired?: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isAdmin = false,
  onSessionExpired
}) => {
  const [sessionInfo, setSessionInfo] = useState(getSessionInfo());
  const [showWarning, setShowWarning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      const info = getSessionInfo();
      setSessionInfo(info);

      // Show warning when 5 minutes remaining
      if (info.timeUntilExpiry > 0 && info.timeUntilExpiry <= 5 * 60 * 1000) {
        setShowWarning(true);
      }

      // Auto-logout when session expires
      if (info.isExpired) {
        handleSessionExpired();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSessionExpired = async () => {
    setShowWarning(false);
    clearSecureSession();
    
    toast({
      title: "Session Expired",
      description: "Your session has expired for security reasons. Please log in again.",
      variant: "destructive",
    });

    // Sign out from Supabase
    await supabase.auth.signOut();
    
    if (onSessionExpired) {
      onSessionExpired();
    } else {
      window.location.href = isAdmin ? '/admin-login' : '/auth';
    }
  };

  const handleExtendSession = () => {
    updateSessionActivity();
    setSessionInfo(getSessionInfo());
    setShowWarning(false);
    
    toast({
      title: "Session Extended",
      description: "Your session has been extended for another 30 minutes.",
    });
  };

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning) return null;

  return (
    <Alert className="fixed top-4 right-4 z-50 max-w-md border-warning bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            Session expires in {formatTimeRemaining(sessionInfo.timeUntilExpiry)}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExtendSession}
          className="ml-2"
        >
          Extend
        </Button>
      </AlertDescription>
    </Alert>
  );
};