import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logSecurityEvent } from '@/lib/security';

interface SecurityAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

interface SecurityMetrics {
  suspiciousIPs: string[];
  recentFailedLogins: number;
  activeAlerts: SecurityAlert[];
}

export const useEnhancedSecurity = () => {
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    suspiciousIPs: [],
    recentFailedLogins: 0,
    activeAlerts: []
  });

  // Monitor for suspicious activity patterns
  useEffect(() => {
    const checkSuspiciousActivity = async () => {
      try {
        // Check for recent failed login attempts
        const { data: events, error } = await supabase
          .from('security_events')
          .select('*')
          .in('event_type', ['auth_failed', 'invalid_credentials', 'rate_limit_exceeded'])
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Failed to fetch security events:', error);
          return;
        }

        const failedLogins = events?.length || 0;
        const suspiciousIPs = [...new Set(
          events?.map(e => {
            const metadata = typeof e.metadata === 'object' && e.metadata ? e.metadata as any : {};
            return metadata.ip_address || metadata.client_ip;
          }).filter(ip => ip && ip !== 'unknown') || []
        )];

        // Generate alerts based on patterns
        const alerts: SecurityAlert[] = [];
        
        if (failedLogins > 10) {
          alerts.push({
            id: `high-failed-logins-${Date.now()}`,
            type: 'authentication',
            message: `${failedLogins} failed login attempts in the last 24 hours`,
            severity: failedLogins > 50 ? 'critical' : 'high',
            timestamp: new Date()
          });
        }

        if (suspiciousIPs.length > 5) {
          alerts.push({
            id: `multiple-ips-${Date.now()}`,
            type: 'network',
            message: `Login attempts from ${suspiciousIPs.length} different IP addresses`,
            severity: suspiciousIPs.length > 20 ? 'high' : 'medium',
            timestamp: new Date()
          });
        }

        setSecurityMetrics({
          suspiciousIPs,
          recentFailedLogins: failedLogins,
          activeAlerts: alerts
        });

        // Log critical alerts using the existing function
        for (const alert of alerts.filter(a => a.severity === 'critical')) {
          await logSecurityEvent(
            'automated_security_alert',
            {
              alert_type: alert.type,
              alert_message: alert.message,
              metrics: { failedLogins, suspiciousIPCount: suspiciousIPs.length }
            }
          );
        }

      } catch (error) {
        console.error('Security monitoring error:', error);
      }
    };

    // Initial check
    checkSuspiciousActivity();

    // Set up periodic monitoring
    const interval = setInterval(checkSuspiciousActivity, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Enhanced geolocation tracking for login events
  const trackLoginLocation = async (eventType: string) => {
    try {
      // Get approximate location from browser (if available)
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            await logSecurityEvent(
              eventType,
              {
                location: {
                  latitude: latitude.toFixed(2), // Reduced precision for privacy
                  longitude: longitude.toFixed(2),
                  accuracy: position.coords.accuracy
                },
                timestamp: new Date().toISOString()
              }
            );
          },
          (error) => {
            // Silently handle geolocation errors
            console.debug('Geolocation not available:', error.message);
          },
          {
            timeout: 5000,
            maximumAge: 300000, // 5 minutes
            enableHighAccuracy: false
          }
        );
      }
    } catch (error) {
      console.debug('Location tracking error:', error);
    }
  };

  return {
    securityMetrics,
    trackLoginLocation
  };
};