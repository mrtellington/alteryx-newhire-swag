import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function SiteHeader() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      if (session?.user?.email) {
        checkAdminStatus(session.user.email);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        if (session?.user?.email) {
          checkAdminStatus(session.user.email);
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('is_user_admin', { user_email: email });
      if (!error) {
        setIsAdmin(data || false);
        
        // Log admin access attempts for security monitoring
        if (data) {
          await supabase.rpc('log_security_event', {
            event_type_param: 'admin_access',
            metadata_param: { action: 'admin_check', result: 'success' }
          });
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="container py-4 md:py-6 flex items-center justify-between">
        <a href="/shop" aria-label="Alteryx Swag Store home">
          <img
            src="/lovable-uploads/208e6bfa-df2a-49ae-8ec6-845390b8b855.png"
            alt="Alteryx Swag Store New Hire logo"
            className="h-10 md:h-12 w-auto"
            loading="eager"
          />
        </a>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={async () => {
              await supabase.rpc('log_security_event', {
                event_type_param: 'admin_panel_access',
                metadata_param: { action: 'navigate_to_admin' }
              });
              window.location.href = "/admin";
            }}>
              Admin
            </Button>
          )}
          {user && (
            <Button variant="outline" onClick={async () => {
              try {
                // Clear all local storage
                localStorage.clear();
                sessionStorage.clear();
                
                // Sign out from Supabase
                await supabase.auth.signOut();
                
                // Check if user was an admin to determine redirect
                if (isAdmin) {
                  window.location.href = "/admin/login";
                } else {
                  window.location.href = "/auth";
                }
              } catch (error) {
                console.error('Error signing out:', error);
                // Force reload with appropriate redirect based on admin status
                if (isAdmin) {
                  window.location.href = "/admin/login";
                } else {
                  window.location.href = "/auth";
                }
              }
            }}>
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
