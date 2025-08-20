import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, RotateCcw, Download, Search, ChevronUp, ChevronDown, Edit, ChevronDown as ChevronDownIcon, MoreHorizontal, Truck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AdminManagement from "@/components/AdminManagement";
import { SessionTimeoutWarning } from "@/components/security/SessionTimeoutWarning";
import { useSessionSecurity } from "@/hooks/useSessionSecurity";


interface User {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  shipping_address: any;
  order_submitted: boolean;
  created_at: string;
  orders?: Array<{
    id: string;
    order_number: string;
    date_submitted: string;
    tee_size: string | null;
    tracking_number?: string | null;
    shipping_carrier?: string | null;
    status?: string | null;
  }>;
}

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof User | 'name' | 'orderDate' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    first_name: "",
    last_name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: ""
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [editingShipping, setEditingShipping] = useState<{orderId: string, tracking: string, carrier: string} | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Initialize session security monitoring
  const { trackActivity } = useSessionSecurity({
    enableAutoExtend: true,
    enableActivityTracking: true,
    enableSecurityLogging: true
  });

  const sendTrackingNotification = async (orderId: string) => {
    try {
      console.log('Sending tracking notification for order:', orderId);
      
      const { data, error } = await supabase.functions.invoke('send-tracking-notification', {
        body: { orderId }
      });

      if (error) {
        console.error('Error sending tracking notification:', error);
        toast({
          title: "Error",
          description: "Failed to send tracking notification",
          variant: "destructive",
        });
      } else {
        console.log('Tracking notification sent successfully:', data);
        toast({
          title: "Success",
          description: "Tracking notification sent successfully",
        });
      }
    } catch (error) {
      console.error('Error in sendTrackingNotification:', error);
      toast({
        title: "Error",
        description: "Failed to send tracking notification",
        variant: "destructive",
      });
    }
  };

  // Helper function to get clean display name from user data
  const getDisplayName = (user: User) => {
    // If we have clean first/last names, use them
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    
    // If full_name is a JSON object (old format), parse it
    if (typeof user.full_name === 'string' && user.full_name.startsWith('{')) {
      try {
        const nameObj = JSON.parse(user.full_name);
        if (nameObj.FirstAndLast) {
          return nameObj.FirstAndLast;
        } else if (nameObj.First && nameObj.Last) {
          return `${nameObj.First} ${nameObj.Last}`;
        } else if (nameObj.First) {
          return nameObj.First;
        }
      } catch (error) {
        console.error('Error parsing name JSON:', error);
      }
    }
    
    // Fallback to full_name or empty
    return user.full_name || '-';
  };

  useEffect(() => {
    const initAdmin = async () => {
      await checkAdminAccess();
      // Only fetch users if admin access was successful (currentUser will be set)
    };
    initAdmin();
  }, []);

  // Separate useEffect to fetch users after admin check is complete
  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser]);

  // Sort function
  const sortUsers = (field: keyof User | 'name' | 'orderDate') => {
    const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(direction);
    
    const sorted = [...filteredUsers].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (field) {
        case 'name':
          aValue = getDisplayName(a).toLowerCase();
          bValue = getDisplayName(b).toLowerCase();
          break;
        case 'first_name':
          aValue = (a.first_name || '').toLowerCase();
          bValue = (b.first_name || '').toLowerCase();
          break;
        case 'last_name':
          aValue = (a.last_name || '').toLowerCase();
          bValue = (b.last_name || '').toLowerCase();
          break;
        case 'orderDate':
          aValue = a.orders?.[0]?.date_submitted || '';
          bValue = b.orders?.[0]?.date_submitted || '';
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'order_submitted':
          aValue = a.order_submitted ? 1 : 0;
          bValue = b.order_submitted ? 1 : 0;
          break;
        case 'created_at':
          aValue = a.created_at;
          bValue = b.created_at;
          break;
        default:
          aValue = a[field];
          bValue = b[field];
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredUsers(sorted);
  };

  // Filter users based on search query
  useEffect(() => {
    let filtered = users;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = users.filter(user => {
        // Search in email
        const emailMatch = user.email.toLowerCase().includes(query);
        
        // Search in name (handle both clean names and JSON format)
        let nameMatch = false;
        const displayName = getDisplayName(user);
        nameMatch = displayName.toLowerCase().includes(query);
        
        // Search in order numbers
        const orderMatch = user.orders?.some(order => 
          order.order_number?.toLowerCase().includes(query)
        ) || false;
        
        return emailMatch || nameMatch || orderMatch;
      });
    }
    
    setFilteredUsers(filtered);
    
    // Reset sorting when users change
    if (sortField) {
      setSortField(null);
      setSortDirection('asc');
    }
  }, [users, searchQuery]);

  const checkAdminAccess = async () => {
    try {
      console.log('Checking admin access...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setLoading(false);
        navigate("/admin/login");
        return;
      }
      
      if (!session) {
        console.log('No session found, redirecting to login');
        setLoading(false);
        navigate("/admin/login");
        return;
      }

      console.log('Session found, checking admin status for:', session.user.email);

      // Use the new admin checking function
      const { data: isAdmin, error } = await supabase.rpc('is_user_admin', { 
        user_email: session.user.email 
      });

      console.log('Admin check result:', { isAdmin, error });

      if (error) {
        console.error('Error checking admin status:', error);
        setLoading(false);
        toast({
          title: "Access Denied",
          description: "Unable to verify admin access.",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      if (!isAdmin) {
        console.log('User is not admin, logging unauthorized access');
        // Log unauthorized admin access attempt
        await supabase.rpc('log_security_event', {
          event_type: 'unauthorized_admin_access',
          metadata: { 
            email: session.user.email,
            attempted_access: 'admin_dashboard',
            timestamp: new Date().toISOString()
          }
        });

        setLoading(false);
        toast({
          title: "Access Denied",
          description: "You don't have admin access.",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      console.log('Admin access confirmed, logging successful access');
      // Log successful admin access
      await supabase.rpc('log_security_event', {
        event_type: 'admin_dashboard_access',
        metadata: { 
          email: session.user.email,
          timestamp: new Date().toISOString()
        }
      });

      setCurrentUser(session.user);
      console.log('Admin access check complete, proceeding to fetch data');
    } catch (error) {
      console.error('Error in admin access check:', error);
      setLoading(false);
      toast({
        title: "Access Denied",
        description: "System error during admin verification.",
        variant: "destructive"
      });
      navigate("/");
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from("users")
        .select(`
          *,
          orders (
            id,
            order_number,
            date_submitted,
            tee_size,
            tracking_number,
            shipping_carrier,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our User interface
      const transformedUsers: User[] = (usersData || []).map(user => ({
        ...user,
        orders: Array.isArray(user.orders) ? user.orders : user.orders ? [user.orders] : []
      }));
      
      setUsers(transformedUsers);
      setFilteredUsers(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    try {
      const shippingAddress = {
        address: newUser.address,
        city: newUser.city,
        state: newUser.state,
        zip: newUser.zip,
        phone: newUser.phone
      };

      const { error } = await supabase.functions.invoke("cognito-webhook", {
        body: {
          email: newUser.email,
          full_name: `${newUser.first_name} ${newUser.last_name}`,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          shipping_address: shippingAddress
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User added successfully"
      });

      setIsAddUserOpen(false);
      setNewUser({
        email: "",
        first_name: "",
        last_name: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        phone: ""
      });
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive"
      });
    }
  };


  const updateShippingInfo = async (orderId: string, trackingNumber: string, shippingCarrier: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          tracking_number: trackingNumber,
          shipping_carrier: shippingCarrier 
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating shipping info:', error);
        toast({
          title: "Error",
          description: "Failed to update shipping information",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Success",
        description: "Shipping information updated successfully"
      });

      fetchUsers();
      setEditingShipping(null);
    } catch (error) {
      console.error('Error updating shipping info:', error);
      toast({
        title: "Error",
        description: "Failed to update shipping information",
        variant: "destructive"
      });
    }
  };

  const resetOrderPermission = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ order_submitted: false })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order permission reset successfully"
      });

      fetchUsers();
    } catch (error) {
      console.error("Error resetting order permission:", error);
      toast({
        title: "Error",
        description: "Failed to reset order permission",
        variant: "destructive"
      });
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
      
      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const user: any = {};
        headers.forEach((header, index) => {
          user[header] = values[index] || '';
        });
        return user;
      });

      let successCount = 0;
      let errorCount = 0;

      for (const user of users) {
        // Handle different possible email column names
        const email = user.email || user.email_address || user.emailaddress;
        
        if (email) {
          try {
            // Handle different possible name column names with priority for exact matches
            let firstName = user.first_name || user.firstname || user.fname || user.given_name || '';
            let lastName = user.last_name || user.lastname || user.lname || user.family_name || user.surname || '';
            let fullName = user.full_name || user.fullname || user.name || user.display_name || '';
            
            // Clean up the name fields
            firstName = firstName.trim();
            lastName = lastName.trim();
            fullName = fullName.trim();
            
            // If we have individual names but no full name, construct it
            if ((firstName || lastName) && !fullName) {
              fullName = `${firstName} ${lastName}`.trim();
            }
            
            // If we have full name but missing individual names, split it
            if (fullName && (!firstName || !lastName)) {
              const nameParts = fullName.split(/\s+/);
              if (nameParts.length >= 2) {
                if (!firstName) firstName = nameParts[0];
                if (!lastName) lastName = nameParts.slice(1).join(' ');
              } else if (nameParts.length === 1 && !firstName) {
                firstName = nameParts[0];
              }
            }
            
            const shippingAddress = {
              address: user.address || user.street_address || user.address_line_1 || '',
              city: user.city || '',
              state: user.state || user.province || user.region || '',
              zip: user.zip || user.zipcode || user.postal_code || user.postcode || '',
              phone: user.phone || user.phone_number || user.telephone || ''
            };

            console.log(`Importing user: ${email}`, {
              firstName,
              lastName,
              fullName,
              shippingAddress
            });

            const { data, error } = await supabase.functions.invoke("cognito-webhook", {
              body: {
                email: email,
                full_name: fullName,
                first_name: firstName,
                last_name: lastName,
                shipping_address: shippingAddress
              }
            });

            if (error) {
              console.error(`Error importing user ${email}:`, error);
              errorCount++;
            } else {
              console.log(`Successfully imported user ${email}:`, data);
              successCount++;
            }
          } catch (userError) {
            console.error(`Error processing user ${email}:`, userError);
            errorCount++;
          }
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} users. ${errorCount > 0 ? `${errorCount} errors.` : ''}`
      });

      setCsvFile(null);
      
      // Wait a moment for the database to update, then refresh
      setTimeout(() => {
        fetchUsers();
      }, 1000);
      
    } catch (error) {
      console.error("Error importing CSV:", error);
      toast({
        title: "Error",
        description: "Failed to import CSV",
        variant: "destructive"
      });
    }
  };

  const exportUsers = () => {
    const csvContent = [
      "email,first_name,last_name,address,city,state,zip,phone,order_submitted,order_date,order_number,tee_size,tracking_number,shipping_carrier",
      ...users.map(user => {
        const addr = user.shipping_address || {};
        const orderDate = user.orders?.[0]?.date_submitted || '';
        const orderNumber = user.orders?.[0]?.order_number || '';
        const teeSize = user.orders?.[0]?.tee_size || '';
        const trackingNumber = user.orders?.[0]?.tracking_number || '';
        const shippingCarrier = user.orders?.[0]?.shipping_carrier || '';
        return [
          user.email,
          user.first_name || '',
          user.last_name || '',
          addr.line1 || addr.address || '',
          addr.city || '',
          addr.region || addr.state || '',
          addr.postal_code || addr.zip || '',
          addr.phone || '',
          user.order_submitted,
          orderDate,
          orderNumber,
          teeSize,
          trackingNumber,
          shippingCarrier
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <SessionTimeoutWarning isAdmin={true} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={exportUsers} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@alteryx.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={newUser.first_name}
                      onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={newUser.last_name}
                      onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newUser.address}
                    onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newUser.city}
                      onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={newUser.state}
                      onChange={(e) => setNewUser({ ...newUser, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="zip">ZIP</Label>
                    <Input
                      id="zip"
                      value={newUser.zip}
                      onChange={(e) => setNewUser({ ...newUser, zip: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={addUser} className="w-full">
                  Add User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      
      <AdminManagement />

      <Card>
        <CardHeader>
          <CardTitle>CSV Import</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
            <Button onClick={handleCsvUpload} disabled={!csvFile}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Flexible column mapping supports various name formats (e.g., first_name/firstname/fname, last_name/lastname/surname, email/email_address)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by email, name, or order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => sortUsers('email')}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {sortField === 'email' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                   <TableHead 
                     className="cursor-pointer hover:bg-muted/50 select-none"
                     onClick={() => sortUsers('first_name')}
                   >
                     <div className="flex items-center gap-1">
                       First Name
                       {sortField === 'first_name' && (
                         sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                       )}
                     </div>
                   </TableHead>
                   <TableHead 
                     className="cursor-pointer hover:bg-muted/50 select-none"
                     onClick={() => sortUsers('last_name')}
                   >
                     <div className="flex items-center gap-1">
                       Last Name
                       {sortField === 'last_name' && (
                         sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                       )}
                     </div>
                   </TableHead>
                   <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => sortUsers('order_submitted')}
                  >
                    <div className="flex items-center gap-1">
                      Order Status
                      {sortField === 'order_submitted' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => sortUsers('orderDate')}
                  >
                    <div className="flex items-center gap-1">
                      Order Info
                      {sortField === 'orderDate' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const addr = user.shipping_address || {};
                  const order = user.orders?.[0];
                  
                  return (
                     <TableRow key={user.id}>
                       <TableCell className="font-medium">{user.email}</TableCell>
                       <TableCell>
                         {user.first_name || '-'}
                       </TableCell>
                       <TableCell>
                         {user.last_name || '-'}
                       </TableCell>
                      <TableCell>
                        {addr.line1 || addr.address ? (
                          <div className="text-sm">
                            {addr.line1 || addr.address}<br />
                            {addr.line2 && <>{addr.line2}<br /></>}
                            {addr.city}, {addr.region || addr.state} {addr.postal_code || addr.zip}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{addr.phone || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            user.order_submitted
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {user.order_submitted ? "Ordered" : "Pending"}
                        </span>
                      </TableCell>
                        <TableCell>
                          {user.orders && user.orders.length > 0 ? (
                            <div className="text-sm space-y-1">
                               {user.orders.map((order, index) => (
                                 <div key={order.id} className="flex items-center gap-2">
                                   <div className="flex flex-col">
                                     <div className="font-medium">{new Date(order.date_submitted).toLocaleDateString()}</div>
                                     <div className="text-muted-foreground text-xs">{order.order_number}</div>
                                   </div>
                                   
                                   {order.tee_size && (
                                     <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                       {order.tee_size}
                                     </span>
                                   )}
                                   
                                   {order.tracking_number && (
                                     <TooltipProvider>
                                       <Tooltip>
                                         <TooltipTrigger>
                                           <Truck className="w-4 h-4 text-muted-foreground" />
                                         </TooltipTrigger>
                                         <TooltipContent className="bg-background border shadow-lg">
                                           <div className="text-xs space-y-1">
                                             <div><strong>Carrier:</strong> {order.shipping_carrier || 'Not specified'}</div>
                                             <div><strong>Tracking:</strong> {order.tracking_number}</div>
                                           </div>
                                         </TooltipContent>
                                       </Tooltip>
                                     </TooltipProvider>
                                   )}
                                 </div>
                               ))}
                            </div>
                          ) : "-"}
                        </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           {user.order_submitted && (
                             <>
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => resetOrderPermission(user.id)}
                               >
                                 <RotateCcw className="w-4 h-4 mr-1" />
                                 Reset
                               </Button>
                               
                               {user.orders && user.orders.length > 0 && (
                                 <DropdownMenu>
                                   <DropdownMenuTrigger asChild>
                                     <Button variant="outline" size="sm">
                                       <MoreHorizontal className="w-4 h-4" />
                                     </Button>
                                   </DropdownMenuTrigger>
                                     <DropdownMenuContent align="end" className="w-48 bg-background border z-50">
                                       {user.orders.map((order) => (
                                         <React.Fragment key={order.id}>
                                           <DropdownMenuItem 
                                             onClick={() => setEditingShipping({
                                               orderId: order.id, 
                                               tracking: order.tracking_number || '',
                                               carrier: order.shipping_carrier || ''
                                             })}
                                           >
                                              <Edit className="w-4 h-4 mr-2" />
                                              Edit Tracking
                                           </DropdownMenuItem>
                                           {order.tracking_number && (
                                             <DropdownMenuItem 
                                               onClick={() => sendTrackingNotification(order.id)}
                                             >
                                               <Truck className="w-4 h-4 mr-2" />
                                               Send Tracking Email
                                             </DropdownMenuItem>
                                           )}
                                         </React.Fragment>
                                       ))}
                                     </DropdownMenuContent>
                                 </DropdownMenu>
                               )}
                             </>
                           )}
                         </div>
                       </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredUsers.length === 0 && searchQuery && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching "{searchQuery}"
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Combined Shipping Info Edit Dialog */}
      <Dialog open={!!editingShipping} onOpenChange={() => setEditingShipping(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tracking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="carrier">Shipping Carrier</Label>
              <Select
                value={editingShipping?.carrier || ''}
                onValueChange={(value) => setEditingShipping(prev => prev ? {...prev, carrier: value} : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                value={editingShipping?.tracking || ''}
                onChange={(e) => setEditingShipping(prev => prev ? {...prev, tracking: e.target.value} : null)}
                placeholder="Enter tracking number"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingShipping(null)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (editingShipping) {
                  updateShippingInfo(editingShipping.orderId, editingShipping.tracking, editingShipping.carrier);
                }
              }}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}