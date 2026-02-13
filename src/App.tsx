import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import UsersPage from "./pages/admin/UsersPage";
import DealsPage from "./pages/admin/DealsPage";
import ArchivePage from "./pages/admin/ArchivePage";
import LogsPage from "./pages/admin/LogsPage";
import SensitivePage from "./pages/admin/SensitivePage";
import SettingsPage from "./pages/admin/SettingsPage";
import ProductSearchPage from "./pages/admin/ProductSearchPage";
import ClientLayout from "./components/client/ClientLayout";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientDeals from "./pages/client/ClientDeals";
import ClientArchive from "./pages/client/ClientArchive";
import ClientAccount from "./pages/client/ClientAccount";
import ClientNotifications from "./pages/client/ClientNotifications";
import ClientSupport from "./pages/client/ClientSupport";
import InspectorLayout from "./components/inspector/InspectorLayout";
import InspectorDashboard from "./pages/inspector/InspectorDashboard";
import BriefingPage from "./pages/inspector/BriefingPage";
import GeofencePage from "./pages/inspector/GeofencePage";
import CapturePage from "./pages/inspector/CapturePage";
import ValidatePage from "./pages/inspector/ValidatePage";
import ReportsPage from "./pages/inspector/ReportsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="deals" element={<DealsPage />} />
              <Route path="archive" element={<ArchivePage />} />
              <Route path="product-search" element={<ProductSearchPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="sensitive" element={<SensitivePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="/client" element={<ClientLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="deals" element={<ClientDeals />} />
              <Route path="archive" element={<ClientArchive />} />
              <Route path="account" element={<ClientAccount />} />
              <Route path="notifications" element={<ClientNotifications />} />
              <Route path="support" element={<ClientSupport />} />
            </Route>
            <Route path="/inspector" element={<InspectorLayout />}>
              <Route index element={<InspectorDashboard />} />
              <Route path="briefing" element={<BriefingPage />} />
              <Route path="geofence" element={<GeofencePage />} />
              <Route path="capture" element={<CapturePage />} />
              <Route path="validate" element={<ValidatePage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
