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

export default function App() {
  return (
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
  );
}
