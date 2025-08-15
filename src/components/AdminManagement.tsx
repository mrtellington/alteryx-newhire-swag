import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Shield, ShieldOff } from "lucide-react";

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
  created_by: string | null;
  active: boolean;
}

export default function AdminManagement() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdminUsers(data || []);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch admin users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail) return;

    try {
      // First, validate the email domain
      const emailLower = newAdminEmail.toLowerCase().trim();
      if (emailLower !== 'tod.ellington@gmail.com' && !emailLower.endsWith('@alteryx.com') && !emailLower.endsWith('@whitestonebranding.com')) {
        toast({
          title: "Invalid Email",
          description: "Admin users must have @alteryx.com or @whitestonebranding.com email addresses",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .insert({
          user_id: crypto.randomUUID(), // Generate a temporary user_id
          email: newAdminEmail.toLowerCase(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Error",
            description: "This email is already an admin user",
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      // Log the admin creation event
      await supabase.rpc('log_security_event', {
        event_type: 'admin_user_added',
        metadata: { 
          new_admin_email: newAdminEmail,
          added_by: (await supabase.auth.getUser()).data.user?.email
        }
      });

      toast({
        title: "Success",
        description: "Admin user added successfully"
      });

      setIsAddAdminOpen(false);
      setNewAdminEmail("");
      fetchAdminUsers();
    } catch (error) {
      console.error("Error adding admin user:", error);
      toast({
        title: "Error",
        description: "Failed to add admin user",
        variant: "destructive"
      });
    }
  };

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("admin_users")
        .update({ active: !currentStatus })
        .eq("id", adminId);

      if (error) throw error;

      // Log the status change
      await supabase.rpc('log_security_event', {
        event_type: 'admin_status_changed',
        metadata: { 
          admin_id: adminId,
          new_status: !currentStatus ? 'active' : 'inactive',
          changed_by: (await supabase.auth.getUser()).data.user?.email
        }
      });

      toast({
        title: "Success",
        description: `Admin user ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });

      fetchAdminUsers();
    } catch (error) {
      console.error("Error updating admin status:", error);
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-lg">Loading admin users...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Admin User Management</CardTitle>
          <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Admin User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="admin@alteryx.com"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Must be @alteryx.com or @whitestonebranding.com
                  </p>
                </div>
                <Button onClick={addAdmin} className="w-full" disabled={!newAdminEmail}>
                  Add Admin User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.email}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 w-fit ${
                        admin.active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {admin.active ? (
                        <Shield className="w-3 h-3" />
                      ) : (
                        <ShieldOff className="w-3 h-3" />
                      )}
                      {admin.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(admin.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAdminStatus(admin.id, admin.active)}
                    >
                      {admin.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {adminUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No admin users found
          </div>
        )}
      </CardContent>
    </Card>
  );
}