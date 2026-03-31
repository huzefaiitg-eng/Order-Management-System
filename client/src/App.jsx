import { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Insights from './pages/Insights';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import ArchivedCustomers from './pages/ArchivedCustomers';
import InventoryPage from './pages/Inventory';
import ProductDetail from './pages/ProductDetail';
import ArchivedInventory from './pages/ArchivedInventory';

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

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:rowIndex" element={<OrderDetail />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/archived" element={<ArchivedInventory />} />
              <Route path="/inventory/:articleId" element={<ProductDetail />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/archived" element={<ArchivedCustomers />} />
              <Route path="/customers/:phone" element={<CustomerDetail />} />
              <Route path="/insights" element={<Insights />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
