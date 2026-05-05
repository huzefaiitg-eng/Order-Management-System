import { Component } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import AddOrder from './pages/AddOrder';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import ArchivedCustomers from './pages/ArchivedCustomers';
import InventoryPage from './pages/Inventory';
import InventoryUpsell from './pages/InventoryUpsell';
import ProductDetail from './pages/ProductDetail';
import ArchivedInventory from './pages/ArchivedInventory';
import SettingsPage from './pages/Settings';
import LandingPage from './pages/LandingPage';
import Leads from './pages/Leads';
import LeadDashboard from './pages/LeadDashboard';
import LeadDetail from './pages/LeadDetail';
import AddLead from './pages/AddLead';
import ArchivedLeads from './pages/ArchivedLeads';

/**
 * Renders the inventory page for users with access, or the upsell/marketing
 * page for users without. Same gate is reused for archived + product detail.
 */
function InventoryGate({ children }) {
  const { user } = useAuth();
  if (!user?.hasInventoryAccess) return <InventoryUpsell />;
  return children;
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
            <p className="text-sm text-gray-500">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppLayout() {
  return (
    // flex-col on mobile (topbar above content), flex-row on desktop (sidebar beside content)
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/new" element={<AddOrder />} />
                <Route path="/orders/:rowIndex" element={<OrderDetail />} />
                <Route path="/inventory" element={<InventoryGate><InventoryPage /></InventoryGate>} />
                <Route path="/inventory/archived" element={<InventoryGate><ArchivedInventory /></InventoryGate>} />
                <Route path="/inventory/:articleId" element={<InventoryGate><ProductDetail /></InventoryGate>} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/archived" element={<ArchivedCustomers />} />
                <Route path="/customers/:phone" element={<CustomerDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/leads/dashboard" element={<LeadDashboard />} />
                <Route path="/leads/new" element={<AddLead />} />
                <Route path="/leads/archived" element={<ArchivedLeads />} />
                <Route path="/leads/:leadId" element={<LeadDetail />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
