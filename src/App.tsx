import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Shop from "./pages/Shop";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import ThankYou from "./pages/ThankYou";
import OrderStatus from "./pages/OrderStatus";
import SiteHeader from "./components/SiteHeader";
import { SecurityErrorBoundary } from "./components/security/SecurityErrorBoundary";
import { SecurityHeaders } from "./components/security/SecurityHeaders";
import { CSRFProvider } from "./components/security/CSRFProtection";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CSRFProvider>
        <SecurityErrorBoundary>
          <SecurityHeaders />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SiteHeader />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/thank-you" element={<ThankYou />} />
              <Route path="/order-status" element={<OrderStatus />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SecurityErrorBoundary>
      </CSRFProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
