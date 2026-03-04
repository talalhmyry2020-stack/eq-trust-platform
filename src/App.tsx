import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import DemoPage from "./pages/DemoPage";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import UsersPage from "./pages/admin/UsersPage";
import DealsPage from "./pages/admin/DealsPage";
import ArchivePage from "./pages/admin/ArchivePage";
import LogsPage from "./pages/admin/LogsPage";
import SensitivePage from "./pages/admin/SensitivePage";
import SettingsPage from "./pages/admin/SettingsPage";
import ProductSearchPage from "./pages/admin/ProductSearchPage";
import DealSearchResultsPage from "./pages/admin/DealSearchResultsPage";
import ClientDealsPage from "./pages/admin/ClientDealsPage";
import FactorySearchPage from "./pages/admin/FactorySearchPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminChatPage from "./pages/admin/AdminChatPage";
import DealNegotiationsPage from "./pages/admin/DealNegotiationsPage";
import ContractReviewPage from "./pages/admin/ContractReviewPage";
import AdminContractsPage from "./pages/admin/AdminContractsPage";
import AdminFinancePage from "./pages/admin/AdminFinancePage";
import AdminInspectorAssignPage from "./pages/admin/AdminInspectorAssignPage";
import LogisticsPage from "./pages/admin/LogisticsPage";
import PortClearancePage from "./pages/admin/PortClearancePage";
import WorkflowManagerPage from "./pages/admin/WorkflowManagerPage";
import WorkflowEditorPage from "./pages/admin/WorkflowEditorPage";
import ClientLayout from "./components/client/ClientLayout";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientDeals from "./pages/client/ClientDeals";
import ClientArchive from "./pages/client/ClientArchive";
import ClientAccount from "./pages/client/ClientAccount";
import ClientNotifications from "./pages/client/ClientNotifications";
import ClientSupport from "./pages/client/ClientSupport";
import ClientChatPage from "./pages/client/ClientChatPage";
import ClientNegotiationResults from "./pages/client/ClientNegotiationResults";
import ClientContractPage from "./pages/client/ClientContractPage";
import ClientContractsListPage from "./pages/client/ClientContractsListPage";
import ClientTreasuryPage from "./pages/client/ClientTreasuryPage";
import ClientTrackingPage from "./pages/client/ClientTrackingPage";
import InspectorLayout from "./components/inspector/InspectorLayout";
import InspectorDashboard from "./pages/inspector/InspectorDashboard";
import BriefingPage from "./pages/inspector/BriefingPage";
import GeofencePage from "./pages/inspector/GeofencePage";
import CapturePage from "./pages/inspector/CapturePage";
import ValidatePage from "./pages/inspector/ValidatePage";
import ReportsPage from "./pages/inspector/ReportsPage";
import InspectorSettings from "./pages/inspector/InspectorSettings";
import InspectionMissionPage from "./pages/inspector/InspectionMissionPage";
import LogisticsLayout from "./components/logistics/LogisticsLayout";
import LogisticsDashboard from "./pages/logistics/LogisticsDashboard";
import QualityLayout from "./components/quality/QualityLayout";
import QualityDashboard from "./pages/quality/QualityDashboard";
import QualityMissionPage from "./pages/quality/QualityMissionPage";
import QualityReportsPage from "./pages/quality/QualityReportsPage";
import QualitySettingsPage from "./pages/quality/QualitySettingsPage";

const queryClient = new QueryClient();

const FontSizeInit = () => {
  // Initialize font size from localStorage on app load
  const stored = localStorage.getItem("eq_font_size");
  if (stored) document.documentElement.style.fontSize = `${stored}px`;
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <FontSizeInit />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="client-deals" element={<ClientDealsPage />} />
              <Route path="deals" element={<DealsPage />} />
              <Route path="archive" element={<ArchivePage />} />
              <Route path="product-search" element={<ProductSearchPage />} />
              <Route path="deal-search-results" element={<DealSearchResultsPage />} />
              <Route path="factory-search" element={<FactorySearchPage />} />
              <Route path="deal-negotiations" element={<DealNegotiationsPage />} />
              <Route path="contract-review" element={<ContractReviewPage />} />
              <Route path="contracts" element={<AdminContractsPage />} />
              <Route path="finance" element={<AdminFinancePage />} />
              <Route path="inspector-assign" element={<AdminInspectorAssignPage />} />
              <Route path="logistics" element={<LogisticsPage />} />
              <Route path="port-clearance" element={<PortClearancePage />} />
              <Route path="workflow" element={<WorkflowManagerPage />} />
              <Route path="workflow-editor" element={<WorkflowEditorPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="chat" element={<AdminChatPage />} />
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
              <Route path="chat" element={<ClientChatPage />} />
              <Route path="negotiation-results" element={<ClientNegotiationResults />} />
              <Route path="contracts" element={<ClientContractsListPage />} />
              <Route path="treasury" element={<ClientTreasuryPage />} />
              <Route path="tracking" element={<ClientTrackingPage />} />
              <Route path="contract" element={<ClientContractPage />} />
            </Route>
            <Route path="/inspector" element={<InspectorLayout />}>
              <Route index element={<InspectorDashboard />} />
              <Route path="briefing" element={<BriefingPage />} />
              <Route path="geofence" element={<GeofencePage />} />
              <Route path="capture" element={<CapturePage />} />
              <Route path="validate" element={<ValidatePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="mission" element={<InspectionMissionPage />} />
              <Route path="settings" element={<InspectorSettings />} />
            </Route>
            <Route path="/logistics" element={<LogisticsLayout />}>
              <Route index element={<LogisticsDashboard />} />
              <Route path="shipments" element={<LogisticsDashboard />} />
            </Route>
            <Route path="/quality" element={<QualityLayout />}>
              <Route index element={<QualityDashboard />} />
              <Route path="mission" element={<QualityMissionPage />} />
              <Route path="reports" element={<QualityReportsPage />} />
              <Route path="settings" element={<QualitySettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
