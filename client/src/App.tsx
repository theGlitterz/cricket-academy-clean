import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Player-facing pages
import Home from "./pages/Home";
import BookingPage from "./pages/BookingPage";
import BookingStatusPage from "./pages/BookingStatusPage";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminBookingDetail from "./pages/admin/AdminBookingDetail";
import AdminSlots from "./pages/admin/AdminSlots";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminServices from "./pages/admin/AdminServices";
import SuperAdmin from "./pages/admin/SuperAdmin";


function Router() {
  return (
    <Switch>
      {/* Player routes */}
      <Route path="/" component={Home} />
      <Route path="/book" component={BookingPage} />
      <Route path="/book/:serviceSlug" component={BookingPage} />
      <Route path="/booking/status" component={BookingStatusPage} />
      <Route path="/booking/:referenceId" component={BookingStatusPage} />

      {/* Admin routes */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/bookings" component={AdminBookings} />
      <Route path="/admin/bookings/:id" component={AdminBookingDetail} />
      <Route path="/admin/slots" component={AdminSlots} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/services" component={AdminServices} />
      <Route path="/admin/super" component={SuperAdmin} />


      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
