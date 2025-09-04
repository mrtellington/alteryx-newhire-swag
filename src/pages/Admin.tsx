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
import { Plus, Upload, RotateCcw, Download, Search, ChevronUp, ChevronDown, Edit, ChevronDown as ChevronDownIcon, MoreHorizontal, Truck, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SessionTimeoutWarning } from "@/components/security/SessionTimeoutWarning";
import { useSessionSecurity } from "@/hooks/useSessionSecurity";
import { useAdminRole } from "@/hooks/useAdminRole";



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
    order_number: string | null;
    date_submitted: string | null;
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
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentUser: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Initialize session security monitoring
  const { trackActivity } = useSessionSecurity({
    enableAutoExtend: true,
    enableActivityTracking: true,
    enableSecurityLogging: true
  });

  const { isAdmin, isViewOnly, hasAdminAccess } = useAdminRole();

  const sendTrackingNotification = async (orderId: string) => {
    // Check if user is full admin before allowing email sending
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only full administrators can send tracking notifications",
        variant: "destructive",
      });
      return;
    }

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
      console.log('🔐 Starting admin access check...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        setLoading(false);
        navigate("/admin/login");
        return;
      }
      
      if (!session) {
        console.log('❌ No session found, redirecting to login');
        setLoading(false);
        navigate("/admin/login");
        return;
      }

      console.log('✅ Session found for:', session.user.email);

      // Check if user has any admin access (full or view-only)
      console.log('🔍 Checking admin role...');
      const { data: hasAccess, error } = await supabase.rpc('get_admin_role');

      console.log('📊 Admin role check result:', { hasAccess, error });

      if (error) {
        console.error('❌ Error checking admin status:', error);
        setLoading(false);
        toast({
          title: "Access Denied",
          description: "Unable to verify admin access.",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      if (hasAccess === 'none') {
        console.log('❌ User is not admin, logging unauthorized access');
        // Log unauthorized admin access attempt
        await supabase.rpc('log_security_event', {
          event_type_param: 'unauthorized_admin_access',
          metadata_param: { 
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

      console.log('✅ Admin access confirmed with role:', hasAccess);
      // Log successful admin access
      await supabase.rpc('log_security_event', {
        event_type_param: 'admin_dashboard_access',
        metadata_param: { 
          email: session.user.email,
          role: hasAccess,
          timestamp: new Date().toISOString()
        }
      });

      setCurrentUser(session.user);
      console.log('✅ Admin access check complete, proceeding to fetch data');
    } catch (error) {
      console.error('❌ Error in admin access check:', error);
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
      console.log('🔍 Starting fetchUsers...');
      
      // First get all users
      console.log('📥 Fetching users from database...');
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      console.log('📊 Users query result:', { 
        userCount: usersData?.length, 
        error: usersError?.message,
        firstUser: usersData?.[0]?.email 
      });

      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        throw usersError;
      }

      // Try to get orders using the new admin function
      console.log('📦 Fetching orders using admin function...');
      const { data: ordersData, error: ordersError } = await supabase
        .rpc('get_all_orders_for_admin');

      console.log('📊 Orders query result:', { 
        orderCount: ordersData?.length, 
        error: ordersError?.message 
      });
      
      // If orders failed due to RLS, use empty array
      const finalOrders = ordersData || [];
      
      // Transform the data to match our User interface
      const transformedUsers: User[] = (usersData || []).map(user => {
        // Find orders for this user
        const userOrders = finalOrders.filter((order: any) => order.user_id === user.id);
        
        console.log(`🔍 User ${user.email}: ${userOrders.length} orders`);
        
        return {
          ...user,
          orders: userOrders
        };
      });
      
      console.log('✅ Final transformed users:', transformedUsers.length);
      setUsers(transformedUsers);
      setFilteredUsers(transformedUsers);
    } catch (error) {
      console.error("❌ Error in fetchUsers:", error);
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
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only full admins can add users",
        variant: "destructive",
      });
      return;
    }

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
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only full admins can update shipping information",
        variant: "destructive",
      });
      return;
    }

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
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only full admins can reset order permissions",
        variant: "destructive",
      });
      return;
    }

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

  const uploadCSV = async (file: File) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only full admins can upload CSV files",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: 0, currentUser: '' });
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast({
          title: "Error",
          description: "CSV file is empty",
          variant: "destructive"
        });
        return;
      }

      // Skip header row
      const dataLines = lines.slice(1);
      
      // Step 1: Clean up orphaned auth accounts first
      console.log('🧹 Step 1: Cleaning up orphaned auth accounts...');
      setImportProgress({ current: 0, total: dataLines.length + 2, currentUser: 'Cleaning up orphaned auth accounts...' });
      
      try {
        const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('cleanup-auth-users', {
          body: {}
        });
        
        if (cleanupError) {
          console.warn('⚠️ Cleanup function had issues:', cleanupError);
        } else {
          console.log('✅ Cleanup completed:', cleanupData);
          const deletedCount = cleanupData?.totalDeleted || 0;
          if (deletedCount > 0) {
            toast({
              title: "Cleanup Complete",
              description: `Removed ${deletedCount} orphaned auth accounts`,
            });
          }
        }
      } catch (cleanupErr) {
        console.warn('⚠️ Auth cleanup failed, continuing with import:', cleanupErr);
      }

      setImportProgress({ current: 1, total: dataLines.length + 2, currentUser: 'Starting user import...' });

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process users in smaller batches with progressive delays to prevent rate limiting
      const batchSize = 3; // Reduced from 5 to 3 for better rate limiting
      const batches = [];
      for (let i = 0; i < dataLines.length; i += batchSize) {
        batches.push(dataLines.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
        
        for (let userIndex = 0; userIndex < batch.length; userIndex++) {
          const line = batch[userIndex];
          const currentIndex = batchIndex * batchSize + userIndex;
          
          try {
            // Parse CSV line - handle both old format (8 fields) and new format (5 fields)
            const fields = line.split(',').map(field => field.trim().replace(/"/g, ''));
            
            let email, firstName, lastName, orderNumber, submittedDate;
            let shippingAddress = null;
            
            if (fields.length >= 8) {
              // Old format: email, firstName, lastName, address, city, state, zip, phone
              [email, firstName, lastName] = fields;
              const [, , , address, city, state, zip, phone] = fields;
              shippingAddress = address || city || state || zip || phone ? {
                address: address || '',
                city: city || '',
                state: state || '',
                zip: zip || '',
                phone: phone || ''
              } : null;
            } else if (fields.length >= 3) {
              // New format: firstName, lastName, email, orderNumber, submittedDate
              [firstName, lastName, email, orderNumber, submittedDate] = fields;
            } else {
              errors.push(`Row ${currentIndex + 2}: Invalid format - need at least 3 fields (firstName, lastName, email)`);
              errorCount++;
              continue;
            }
            
            if (!email || !firstName || !lastName) {
              errors.push(`Row ${currentIndex + 2}: Missing required fields (email, first name, or last name)`);
              errorCount++;
              continue;
            }

            setImportProgress({ 
              current: currentIndex + 1, 
              total: dataLines.length, 
              currentUser: `${firstName} ${lastName} (${email})${orderNumber ? ` - Order: ${orderNumber}` : ''}` 
            });

            const fullName = `${firstName} ${lastName}`;

            // Increased progressive delay to prevent rate limiting
            const delay = Math.min(2000 + (batchIndex * 750) + (userIndex * 500), 5000);
            if (currentIndex > 0) {
              console.log(`Waiting ${delay}ms before processing ${email}...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Create user via webhook function with enhanced retry logic
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;

            while (retryCount < maxRetries && !success) {
              try {
                const { data, error } = await supabase.functions.invoke('cognito-webhook', {
                  body: {
                    email,
                    full_name: fullName,
                    first_name: firstName,
                    last_name: lastName,
                    shipping_address: shippingAddress,
                    order_number: orderNumber || null,
                    order_date: submittedDate || null
                  }
                });

                if (error) {
                  if (error.message?.includes('rate limit') || error.message?.includes('too many requests') || error.message?.includes('already been registered')) {
                    if (retryCount < maxRetries - 1) {
                      retryCount++;
                      const retryDelay = 3000 * Math.pow(2, retryCount); // Exponential backoff
                      console.log(`Rate limited for ${email}, retrying in ${retryDelay}ms... (attempt ${retryCount}/${maxRetries})`);
                      await new Promise(resolve => setTimeout(resolve, retryDelay));
                      continue;
                    }
                  }
                  throw error;
                }

                console.log(`✅ Successfully processed: ${email}`, data);
                successCount++;
                success = true;
              } catch (retryError) {
                if (retryCount === maxRetries - 1) {
                  throw retryError;
                }
                retryCount++;
              }
            }

          } catch (error) {
            console.error(`❌ Error processing row ${currentIndex + 2}:`, error);
            errors.push(`Row ${currentIndex + 2}: ${error.message}`);
            errorCount++;
          }
        }

        // Longer delay between batches to ensure rate limiting compliance
        if (batchIndex < batches.length - 1) {
          const batchDelay = 5000 + (batchIndex * 1000); // Increased from 3000ms
          console.log(`Batch ${batchIndex + 1} complete. Waiting ${batchDelay}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      // Step 2: Create auth accounts for all users
      console.log('🔐 Step 2: Creating auth accounts for all users...');
      setImportProgress({ current: dataLines.length + 1, total: dataLines.length + 2, currentUser: 'Creating auth accounts...' });
      
      try {
        const { data: authData, error: authError } = await supabase.functions.invoke('create-auth-users', {
          body: {}
        });
        
        if (authError) {
          console.warn('⚠️ Auth creation had issues:', authError);
          toast({
            title: "Auth Creation Issues",
            description: "Some users may not have auth accounts. Check console for details.",
            variant: "destructive"
          });
        } else {
          console.log('✅ Auth creation completed:', authData);
          const authSuccessCount = authData?.results?.filter((r: any) => r.success)?.length || 0;
          const authErrorCount = authData?.results?.filter((r: any) => !r.success)?.length || 0;
          
          toast({
            title: "Auth Accounts Created",
            description: `Created ${authSuccessCount} auth accounts${authErrorCount > 0 ? `, ${authErrorCount} had issues` : ''}`,
          });
        }
      } catch (authErr) {
        console.warn('⚠️ Auth creation failed:', authErr);
        toast({
          title: "Auth Creation Failed",
          description: "Users imported but auth accounts may not be created. Check console.",
          variant: "destructive"
        });
      }

      // Show final results with better messaging
      if (successCount > 0) {
        toast({
          title: "Import Complete",
          description: `✅ Successfully imported ${successCount} users with auth account setup`
        });
      }
      
      if (errorCount > 0) {
        toast({
          title: "Warning", 
          description: `❌ Failed to import ${errorCount} users. Check console for details.`,
          variant: "destructive"
        });
        console.error('Import errors:', errors);
      }

      // Also show summary in console
      console.log(`📊 Import Summary: ${successCount} successful, ${errorCount} errors out of ${dataLines.length} total`);

      fetchUsers(); // Refresh the user list
      
      // Step 3: Verify all users have auth accounts
      setTimeout(async () => {
        const { data: usersWithoutAuth } = await supabase
          .from('users')
          .select('email')
          .is('auth_user_id', null)
          .eq('invited', true);
          
        if (usersWithoutAuth && usersWithoutAuth.length > 0) {
          console.warn(`⚠️ ${usersWithoutAuth.length} users still missing auth accounts:`, usersWithoutAuth.map(u => u.email));
          toast({
            title: "Auth Verification",
            description: `${usersWithoutAuth.length} users still need auth accounts`,
            variant: "destructive"
          });
        } else {
          console.log('✅ All users have auth accounts!');
        }
      }, 2000);
      
    } catch (error) {
      console.error('CSV upload error:', error);
      toast({
        title: "Error",
        description: "Failed to process CSV file",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0, currentUser: '' });
    }
  };

  const handleNuclearReset = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only full admins can perform nuclear reset",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('⚠️ WARNING: This will permanently delete ALL users and auth accounts. Are you absolutely sure?')) {
      return;
    }

    if (!confirm('🚨 FINAL WARNING: This action cannot be undone. All user data will be lost forever!')) {
      return;
    }

    setIsDeleting(true);
    
    try {
      console.log('🗑️ Starting nuclear reset - deleting all users and auth accounts...');
      
      // Step 1: Call the nuclear reset edge function
      console.log('🚨 Calling nuclear reset function...');
      const { data: resetResult, error: resetError } = await supabase.functions.invoke('nuclear-reset', {
        body: {}
      });
      
      if (resetError) {
        console.error('❌ Nuclear reset failed:', resetError);
        toast({
          title: "Nuclear Reset Failed",
          description: `Error: ${resetError.message}`,
          variant: "destructive"
        });
      } else {
        console.log('✅ Nuclear reset completed:', resetResult);
        const authDeleted = resetResult?.deleted_auth_users || 0;
        const remaining = resetResult?.remaining_users || 0;
        
        if (remaining === 0) {
          toast({
            title: "🚨 Nuclear Reset Complete",
            description: `Deleted ${authDeleted} auth users. Database is now empty.`,
          });
        } else {
          toast({
            title: "Reset Incomplete",
            description: `${remaining} users still remain in database`,
            variant: "destructive"
          });
        }
      }

      // Refresh the admin dashboard immediately
      fetchUsers();
      
    } catch (error) {
      console.error('💥 Nuclear reset failed:', error);
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Failed to clear all data",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
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
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          {isViewOnly && (
            <p className="text-sm text-muted-foreground mt-1">View-only access</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={exportUsers} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {isAdmin && (
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
          )}
        </div>
      </div>

      {isAdmin && (
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
                disabled={isImporting}
              />
              <Button onClick={() => csvFile && uploadCSV(csvFile)} disabled={!csvFile || isImporting}>
                <Upload className="w-4 h-4 mr-2" />
                {isImporting ? 'Importing...' : 'Import CSV'}
              </Button>
            </div>
          
          {isImporting && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Import Progress</span>
                <span className="text-sm text-muted-foreground">
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2 mb-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              {importProgress.currentUser && (
                <p className="text-xs text-muted-foreground">
                  Currently processing: {importProgress.currentUser}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Processing in batches with rate limiting protection...
              </p>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Supported CSV formats:</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            • <strong>New users:</strong> firstName,lastName,email,orderNumber,submittedDate
          </p>
          <p className="text-xs text-muted-foreground">
            • <strong>Legacy format:</strong> email,firstName,lastName,address,city,state,zip,phone
          </p>
          <p className="text-xs text-muted-foreground">
            • If orderNumber and submittedDate are provided, user will be marked as having ordered
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            ⚡ Enhanced with progressive delays and retry logic to prevent rate limiting issues
          </p>
        </CardContent>
      </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              ✅ Automatic user creation via cognito-webhook is active
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ All new users automatically get auth accounts and can login immediately
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ CSV import and manual user addition use the same reliable process
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ Enhanced rate limiting protection prevents auth creation failures
            </p>
            {false && isAdmin && (
              <div className="pt-4 border-t border-destructive/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-destructive">⚠️ Danger Zone</h3>
                    <p className="text-xs text-muted-foreground">
                      This will permanently delete ALL user data and auth accounts
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleNuclearReset}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      '🗑️ Nuclear Reset'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
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
                      Order Date
                      {sortField === 'orderDate' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Order Number</TableHead>
                  <TableHead>T-Shirt Size</TableHead>
                  <TableHead>Shipping Info</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const order = user.orders?.[0];
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.first_name || '-'}</TableCell>
                      <TableCell>{user.last_name || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.order_submitted 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.order_submitted ? 'Ordered' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {order?.date_submitted 
                          ? new Date(order.date_submitted).toLocaleDateString()
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{order?.order_number || '-'}</TableCell>
                      <TableCell>{order?.tee_size || '-'}</TableCell>
                      <TableCell>
                        {order ? (
                          <div className="text-sm">
                            {editingShipping?.orderId === order.id ? (
                              <div className="space-y-2 min-w-[200px]">
                                <Input
                                  placeholder="Tracking number"
                                  value={editingShipping.tracking}
                                  onChange={(e) => setEditingShipping({
                                    ...editingShipping,
                                    tracking: e.target.value
                                  })}
                                  className="text-xs"
                                />
                                <Select
                                  value={editingShipping.carrier}
                                  onValueChange={(value) => setEditingShipping({
                                    ...editingShipping,
                                    carrier: value
                                  })}
                                >
                                  <SelectTrigger className="text-xs">
                                    <SelectValue placeholder="Select carrier" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UPS">UPS</SelectItem>
                                    <SelectItem value="FedEx">FedEx</SelectItem>
                                    <SelectItem value="USPS">USPS</SelectItem>
                                    <SelectItem value="DHL">DHL</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => updateShippingInfo(order.id, editingShipping.tracking, editingShipping.carrier)}
                                    className="text-xs px-2 py-1 h-6"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingShipping(null)}
                                    className="text-xs px-2 py-1 h-6"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium">
                                  {order.tracking_number || 'No tracking'}
                                </div>
                                <div className="text-muted-foreground">
                                  {order.shipping_carrier || 'No carrier'}
                                </div>
                                <div className="flex gap-1 mt-1">
                                   {isAdmin && (
                                     <Button
                                       size="sm"
                                       variant="outline"
                                       onClick={() => setEditingShipping({
                                         orderId: order.id,
                                         tracking: order.tracking_number || '',
                                         carrier: order.shipping_carrier || ''
                                       })}
                                       className="text-xs px-2 py-1 h-6"
                                     >
                                       <Edit className="w-3 h-3" />
                                     </Button>
                                   )}
                                   {order.tracking_number && isAdmin && (
                                     <TooltipProvider>
                                       <Tooltip>
                                         <TooltipTrigger asChild>
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={() => sendTrackingNotification(order.id)}
                                             className="text-xs px-2 py-1 h-6"
                                           >
                                             <Truck className="w-3 h-3" />
                                           </Button>
                                         </TooltipTrigger>
                                         <TooltipContent>
                                           <p>Send tracking notification</p>
                                         </TooltipContent>
                                       </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                       {isAdmin && (
                         <TableCell>
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" className="h-8 w-8 p-0">
                                 <MoreHorizontal className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               {user.order_submitted && (
                                 <DropdownMenuItem
                                   onClick={() => resetOrderPermission(user.id)}
                                   className="text-amber-600"
                                 >
                                   <RotateCcw className="mr-2 h-4 w-4" />
                                   Reset Order Permission
                                 </DropdownMenuItem>
                               )}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </TableCell>
                       )}
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
