import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Eye } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import StatusSelect from '../components/StatusSelect';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_MODES } from '../utils/formatters';

export default function Orders() {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const { orders, loading, error, refresh, updateStatus } = useOrders(filters);

  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  let sortedOrders = [...orders];
  if (sortField) {
    sortedOrders.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-64"
          />
        </form>

        <select onChange={e => handleFilterChange('source', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="">All Sources</option>
          {ORDER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select onChange={e => handleFilterChange('status', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select onChange={e => handleFilterChange('payment', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="">All Payments</option>
          {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: 'orderDate', label: 'Date' },
                    { key: 'orderFrom', label: 'Source' },
                    { key: 'customerName', label: 'Customer' },
                    { key: 'productOrdered', label: 'Product' },
                    { key: 'modeOfPayment', label: 'Payment' },
                    { key: 'pricePaid', label: 'Price' },
                    { key: 'profit', label: 'Profit' },
                    { key: 'orderStatus', label: 'Status' },
                    { key: null, label: 'Actions' },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={() => col.key && handleSort(col.key)}
                      className={`px-4 py-3 text-left font-medium text-gray-600 ${col.key ? 'cursor-pointer hover:text-gray-900' : ''}`}
                    >
                      {col.label}
                      {sortField === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedOrders.map(order => (
                  <tr key={order.rowIndex} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                        {order.orderFrom}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.customerName}</td>
                    <td className="px-4 py-3 text-gray-600">{order.productOrdered}</td>
                    <td className="px-4 py-3 text-gray-600">{order.modeOfPayment}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                    <td className={`px-4 py-3 font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(order.profit)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        currentStatus={order.orderStatus}
                        onUpdate={(newStatus) => updateStatus(order.rowIndex, newStatus)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/orders/${order.rowIndex}`}
                        className="text-terracotta-600 hover:text-terracotta-800"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {sortedOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No orders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {sortedOrders.length} order{sortedOrders.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
