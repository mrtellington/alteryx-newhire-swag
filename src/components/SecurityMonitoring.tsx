import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_email: string;
  ip_address: string;
  metadata: any;
  created_at: string;
}

interface SecurityDashboardData {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event_count: number;
  unique_users: number;
  first_occurrence: string;
  last_occurrence: string;
}

const SecurityMonitoring = () => {
  const [dashboardData, setDashboardData] = useState<SecurityDashboardData[]>([]);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      // Fetch dashboard summary
      const { data: dashboard, error: dashboardError } = await supabase
        .rpc('get_security_dashboard');

      if (dashboardError) {
        console.error('Dashboard error:', dashboardError);
        toast({
          title: "Error",
          description: "Failed to load security dashboard",
          variant: "destructive"
        });
      } else {
        setDashboardData(dashboard || []);
      }

      // Fetch recent security events (last 20)
      const { data: events, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (eventsError) {
        console.error('Events error:', eventsError);
      } else {
        setRecentEvents(events || []);
      }
    } catch (error) {
      console.error('Security data fetch error:', error);
      toast({
        title: "Error",
        description: "Failed to load security data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <Shield className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading security data...</p>
        </CardContent>
      </Card>
    );
  }

  const criticalEventsCount = dashboardData
    .filter(item => item.severity === 'critical')
    .reduce((sum, item) => sum + item.event_count, 0);

  const highEventsCount = dashboardData
    .filter(item => item.severity === 'high')
    .reduce((sum, item) => sum + item.event_count, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Monitoring Dashboard
          </CardTitle>
          <CardDescription>
            Security events and threats detected in the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-500">{criticalEventsCount}</div>
              <div className="text-sm text-muted-foreground">Critical Events</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-500">{highEventsCount}</div>
              <div className="text-sm text-muted-foreground">High Priority Events</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-500">{dashboardData.length}</div>
              <div className="text-sm text-muted-foreground">Event Types</div>
            </div>
          </div>

          {criticalEventsCount > 0 && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                <strong>Critical Security Alert:</strong> {criticalEventsCount} critical security events detected in the last 24 hours. Immediate attention required.
              </AlertDescription>
            </Alert>
          )}

          {dashboardData.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Security Event Summary</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Unique Users</TableHead>
                    <TableHead>Last Occurrence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {formatEventType(item.event_type)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(item.severity)} className="flex items-center gap-1 w-fit">
                          {getSeverityIcon(item.severity)}
                          {item.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.event_count}</TableCell>
                      <TableCell>{item.unique_users}</TableCell>
                      <TableCell>
                        {new Date(item.last_occurrence).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700">
                No security events detected in the last 24 hours. System appears secure.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
            <CardDescription>
              Latest 20 security events across all time periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-sm">
                      {new Date(event.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatEventType(event.event_type)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityBadgeVariant(event.severity)} className="flex items-center gap-1 w-fit">
                        {getSeverityIcon(event.severity)}
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.user_email || 'Anonymous'}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {event.ip_address || 'Unknown'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={fetchSecurityData} variant="outline">
          Refresh Data
        </Button>
      </div>
    </div>
  );
};

export default SecurityMonitoring;