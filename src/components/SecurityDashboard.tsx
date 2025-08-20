import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Users, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface SecurityMetrics {
  total_users: number;
  users_with_auth: number;
  missing_auth: number;
  recent_security_events: number;
  critical_events: number;
}

interface SecurityEvent {
  event_type: string;
  severity: string;
  event_count: number;
  unique_users: number;
  first_occurrence: string;
  last_occurrence: string;
}

export const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      // Get user metrics
      const { data: userMetrics, error: metricsError } = await supabase
        .rpc('check_user_order_status', { user_email: 'dummy@example.com' })
        .then(() => 
          supabase
            .from('users')
            .select('auth_user_id, invited')
            .eq('invited', true)
        );

      if (metricsError) {
        console.error('Error fetching user metrics:', metricsError);
      } else {
        const totalUsers = userMetrics?.length || 0;
        const usersWithAuth = userMetrics?.filter(u => u.auth_user_id).length || 0;
        setMetrics({
          total_users: totalUsers,
          users_with_auth: usersWithAuth,
          missing_auth: totalUsers - usersWithAuth,
          recent_security_events: 0,
          critical_events: 0
        });
      }

      // Get security dashboard data
      const { data: dashboardData, error: dashboardError } = await supabase
        .rpc('get_security_dashboard');

      if (dashboardError) {
        console.error('Error fetching security dashboard:', dashboardError);
      } else {
        setEvents(dashboardData || []);
        
        // Update metrics with security event counts
        if (dashboardData) {
          const recentEvents = dashboardData.reduce((sum: number, event: SecurityEvent) => sum + event.event_count, 0);
          const criticalEvents = dashboardData
            .filter((event: SecurityEvent) => event.severity === 'critical')
            .reduce((sum: number, event: SecurityEvent) => sum + event.event_count, 0);
          
          setMetrics(prev => prev ? {
            ...prev,
            recent_security_events: recentEvents,
            critical_events: criticalEvents
          } : null);
        }
      }
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fixMissingAuthUsers = async () => {
    setFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-missing-auth-users');
      
      if (error) {
        console.error('Error fixing auth users:', error);
        toast.error('Failed to fix missing auth users');
        return;
      }

      if (data.success_count > 0) {
        toast.success(`✅ Fixed ${data.success_count} missing auth accounts`);
      }
      
      if (data.error_count > 0) {
        toast.error(`⚠️ ${data.error_count} users still need manual attention`);
      }

      // Refresh data
      fetchSecurityData();
    } catch (error) {
      console.error('Error fixing auth users:', error);
      toast.error('Critical error during auth fix');
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{metrics?.total_users || 0}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics?.users_with_auth || 0}</div>
              <div className="text-sm text-muted-foreground">With Auth</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{metrics?.missing_auth || 0}</div>
              <div className="text-sm text-muted-foreground">Missing Auth</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{metrics?.critical_events || 0}</div>
              <div className="text-sm text-muted-foreground">Critical Events</div>
            </div>
          </div>

          {metrics && metrics.missing_auth > 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  <strong>Critical Issue:</strong> {metrics.missing_auth} users are missing authentication accounts and cannot login or order.
                </span>
                <Button 
                  onClick={fixMissingAuthUsers} 
                  disabled={fixing}
                  size="sm"
                  className="ml-4"
                >
                  {fixing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Fixing...
                    </>
                  ) : (
                    'Fix Now'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Security Events (24h)</h3>
            <Button onClick={fetchSecurityData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={getSeverityColor(event.severity)}>
                      {event.severity.toUpperCase()}
                    </Badge>
                    <div>
                      <div className="font-medium">{event.event_type.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.unique_users} users affected
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold">{event.event_count} events</div>
                    <div className="text-muted-foreground">
                      Last: {new Date(event.last_occurrence).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
              <div>No security events in the last 24 hours</div>
              <div className="text-sm">Your system is secure!</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};