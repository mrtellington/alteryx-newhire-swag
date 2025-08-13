import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, Mail } from "lucide-react";

export default function ThankYou() {
  const [user, setUser] = useState<any>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUserAndOrder();
  }, []);

  const checkUserAndOrder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (userError) throw userError;

      setUser(userData);

      // If user hasn't ordered, redirect to shop
      if (!userData.order_submitted) {
        navigate("/shop");
        return;
      }

      // Get order information with tee size
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*, tee_size")
        .eq("user_id", session.user.id)
        .order("date_submitted", { ascending: false })
        .limit(1)
        .single();

      if (orderError) throw orderError;

      setOrderInfo(orderData);
    } catch (error) {
      console.error("Error checking user and order:", error);
      navigate("/shop");
    } finally {
      setLoading(false);
    }
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
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Thank You for Your Order!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your order has been successfully submitted.
          </p>
        </div>

        {orderInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Order Number:</strong>
                  <div className="text-muted-foreground">{orderInfo.order_number}</div>
                </div>
                <div>
                  <strong>Order Date:</strong>
                  <div className="text-muted-foreground">
                    {new Date(orderInfo.date_submitted).toLocaleDateString()}
                  </div>
                </div>
                {orderInfo.tee_size && (
                  <div>
                    <strong>Tee Size:</strong>
                    <div className="text-muted-foreground">{orderInfo.tee_size}</div>
                  </div>
                )}
              </div>
              
              {user?.shipping_address && (
                <div>
                  <strong>Shipping Address:</strong>
                  <div className="text-muted-foreground text-sm mt-1">
                    {user.shipping_address.line1 || user.shipping_address.address}<br />
                    {user.shipping_address.line2 && (
                      <>{user.shipping_address.line2}<br /></>
                    )}
                    {user.shipping_address.city}, {user.shipping_address.region || user.shipping_address.state} {user.shipping_address.postal_code || user.shipping_address.zip}
                    {user.shipping_address.country && (
                      <><br />{user.shipping_address.country}</>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-left">
              <Mail className="h-8 w-8 text-blue-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Confirmation Email Sent</h3>
                <p className="text-sm text-muted-foreground">
                  A confirmation email has been sent to {user?.email}. Please check your inbox for further details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-4">
          <Button onClick={() => navigate("/")} variant="outline">
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
}