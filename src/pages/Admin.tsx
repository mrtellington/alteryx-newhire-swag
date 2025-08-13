import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, RotateCcw, Download } from "lucide-react";

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
  }>;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
    fetchUsers();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/auth";
      return;
    }

    const email = session.user.email;
    if (email !== "admin@whitestonebranding.com" && email !== "dev@whitestonebranding.com") {
      toast({
        title: "Access Denied",
        description: "You don't have admin access.",
        variant: "destructive"
      });
      window.location.href = "/";
      return;
    }

    setCurrentUser(session.user);
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
            date_submitted
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
      const headers = lines[0].split(',').map(h => h.trim());
      
      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const user: any = {};
        headers.forEach((header, index) => {
          user[header] = values[index] || '';
        });
        return user;
      });

      for (const user of users) {
        if (user.email) {
          const shippingAddress = {
            address: user.address || '',
            city: user.city || '',
            state: user.state || '',
            zip: user.zip || '',
            phone: user.phone || ''
          };

          await supabase.functions.invoke("cognito-webhook", {
            body: {
              email: user.email,
              full_name: `${user.first_name || user.name || ''} ${user.last_name || ''}`.trim() || user.name || '',
              first_name: user.first_name || user.name || '',
              last_name: user.last_name || '',
              shipping_address: shippingAddress
            }
          });
        }
      }

      toast({
        title: "Success",
        description: `Imported ${users.length} users successfully`
      });

      setCsvFile(null);
      fetchUsers();
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
      "email,full_name,address,city,state,zip,phone,order_submitted,order_date,order_number",
      ...users.map(user => {
        const addr = user.shipping_address || {};
        const orderDate = user.orders?.[0]?.date_submitted || '';
        const orderNumber = user.orders?.[0]?.order_number || '';
        return [
          user.email,
          user.full_name || '',
          addr.line1 || addr.address || '',
          addr.city || '',
          addr.region || addr.state || '',
          addr.postal_code || addr.zip || '',
          addr.phone || '',
          user.order_submitted,
          orderDate,
          orderNumber
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
            Expected columns: email, first_name, last_name, address, city, state, zip, phone
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Order Date & Number</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const addr = user.shipping_address || {};
                  const order = user.orders?.[0];
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.full_name || "-"}
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
                               <div key={order.id} className="border-b border-muted pb-1 last:border-b-0 last:pb-0">
                                 <div>{new Date(order.date_submitted).toLocaleDateString()}</div>
                                 <div className="text-muted-foreground">{order.order_number}</div>
                               </div>
                             ))}
                           </div>
                         ) : "-"}
                       </TableCell>
                      <TableCell>
                        {user.order_submitted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resetOrderPermission(user.id)}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reset
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}