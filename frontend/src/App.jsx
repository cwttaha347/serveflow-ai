import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Services from './pages/Services';
import Providers from './pages/Providers';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CreateReview from './pages/CreateReview';
import AdminCommissions from './pages/AdminCommissions';
import AdminUsers from './pages/AdminUsers';
import AdminJobs from './pages/AdminJobs';
import CreateRequest from './pages/CreateRequest';
import MyRequests from './pages/MyRequests';
import LiveTracking from './pages/LiveTracking';
import ProviderDashboard from './pages/ProviderDashboard';
import AdminPanel from './pages/AdminPanel';
import DocumentList from './pages/DocumentList';
import Settings from './pages/Settings';
import AdminRequests from './pages/AdminRequests';
import AdminProviders from './pages/AdminProviders';

import AdminAIStats from './pages/AdminAIStats';
import AdminSettings from './pages/AdminSettings';
import AdminCategories from './pages/AdminCategories';
import ProviderProfile from './pages/ProviderProfile';
import ProviderEarnings from './pages/ProviderEarnings';
import ProviderJobDetails from './pages/ProviderJobDetails';
import RequestDetail from './pages/RequestDetail';
import ProviderJobs from './pages/ProviderJobs';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Reviews from './pages/Reviews';
import BrowseRequests from './pages/BrowseRequests';
import SubmitBid from './pages/SubmitBid';
import MyBids from './pages/MyBids';
import AdminAuditLogs from './pages/AdminAuditLogs';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';
import MaintenancePage from './pages/MaintenancePage';
import { useSettings } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { WebSocketProvider } from './context/WebSocketContext';
import PublicLayout from './components/PublicLayout';

const AppRoutes = () => {
  const { settings, loading } = useSettings();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold animate-pulse">Initializing Platform...</p>
      </div>
    );
  }

  if (settings.maintenance_mode && user?.role !== 'admin') {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      {/* Landing Route (Transparent Nav) */}
      <Route element={<PublicLayout transparentNav={true} />}>
        <Route path="/" element={<Landing />} />
      </Route>

      {/* Other Public Routes (Solid Nav) */}
      <Route element={<PublicLayout />}>
        <Route path="/services" element={<Services />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookies" element={<CookiePolicy />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Routes - User */}
      <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="tracking/:id" element={<LiveTracking />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="reviews/create/:jobId" element={<CreateReview />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Provider Routes */}
      <Route path="/dashboard/provider" element={<ProtectedRoute requiredRole="provider"><Layout /></ProtectedRoute>}>
        <Route index element={<ProviderDashboard />} />
        <Route path="jobs" element={<ProviderJobs />} />
        <Route path="profile" element={<ProviderProfile />} />
        <Route path="earnings" element={<ProviderEarnings />} />
        <Route path="jobs/:id" element={<ProviderJobDetails />} />
        <Route path="browse-requests" element={<BrowseRequests />} />
        <Route path="bids/submit/:requestId" element={<SubmitBid />} />
        <Route path="bids" element={<MyBids />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/dashboard/admin" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
        <Route index element={<AdminPanel />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="providers" element={<AdminProviders />} />
        <Route path="ai-stats" element={<AdminAIStats />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="commissions" element={<AdminCommissions />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="documents" element={<DocumentList />} />
      </Route>

      {/* Semi-protected (for request creation) */}
      <Route path="/create-request" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <SettingsProvider>
        <AuthProvider>
          <WebSocketProvider>
            <AppRoutes />
          </WebSocketProvider>
        </AuthProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;
