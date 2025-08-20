import { useState, useEffect, useCallback } from 'react';
import { getSessionInfo, updateSessionActivity, shouldWarnSessionExpiry, logEnhancedSecurityEvent } from '@/lib/security';
import { supabase } from '@/integrations/supabase/client';

export interface UseSessionSecurityOptions {
  enableAutoExtend?: boolean;
  enableActivityTracking?: boolean;
  enableSecurityLogging?: boolean;
}

export const useSessionSecurity = (options: UseSessionSecurityOptions = {}) => {
  const {
    enableAutoExtend = true,
    enableActivityTracking = true,
    enableSecurityLogging = true
  } = options;

  const [sessionInfo, setSessionInfo] = useState(getSessionInfo());
  const [shouldShowWarning, setShouldShowWarning] = useState(false);

  // Track user activity
  const trackActivity = useCallback(() => {
    if (enableActivityTracking) {
      updateSessionActivity();
      setSessionInfo(getSessionInfo());
    }
  }, [enableActivityTracking]);

  // Monitor session status
  useEffect(() => {
    const interval = setInterval(() => {
      const info = getSessionInfo();
      setSessionInfo(info);
      setShouldShowWarning(shouldWarnSessionExpiry());

      // Log session anomalies
      if (enableSecurityLogging && info.isExpired) {
        logEnhancedSecurityEvent('session_expired', {
          sessionDuration: Date.now() - info.startTime,
          lastActivity: info.lastActivity
        }, 'medium');
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [enableSecurityLogging]);

  // Set up activity listeners
  useEffect(() => {
    if (!enableActivityTracking) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Throttle activity tracking to avoid excessive calls
    let lastTrack = 0;
    const throttledTrack = () => {
      const now = Date.now();
      if (now - lastTrack > 60000) { // Track at most once per minute
        trackActivity();
        lastTrack = now;
      }
    };

    events.forEach(event => {
      document.addEventListener(event, throttledTrack, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledTrack);
      });
    };
  }, [enableActivityTracking, trackActivity]);

  // Monitor authentication state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (enableSecurityLogging) {
        logEnhancedSecurityEvent(`auth_${event}`, {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email
        }, event === 'SIGNED_OUT' ? 'low' : 'medium');
      }
    });

    return () => subscription.unsubscribe();
  }, [enableSecurityLogging]);

  const extendSession = useCallback(() => {
    updateSessionActivity();
    setSessionInfo(getSessionInfo());
    setShouldShowWarning(false);
    
    if (enableSecurityLogging) {
      logEnhancedSecurityEvent('session_extended', {
        method: 'manual'
      }, 'low');
    }
  }, [enableSecurityLogging]);

  const forceLogout = useCallback(async () => {
    if (enableSecurityLogging) {
      logEnhancedSecurityEvent('forced_logout', {
        reason: 'security_timeout'
      }, 'medium');
    }
    
    await supabase.auth.signOut();
  }, [enableSecurityLogging]);

  return {
    sessionInfo,
    shouldShowWarning,
    extendSession,
    forceLogout,
    trackActivity
  };
};