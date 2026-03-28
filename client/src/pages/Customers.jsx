import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, User, Phone, MapPin, ShoppingBag, Zap } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { customers, loading, error, refresh } = useCustomers(query);

  const [sortField, setSortField] = useState('totalOrders');
  const [sortDir, setSortDir] = useState('desc');

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(search);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  let sorted = [...customers];
  if (sortField) {
    sorted.sort((a, b) => {
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
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600"><User size={20} /></div>
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 text-green-600"><Zap size={20} /></div>
            <div>
              <p className="text-sm text-gray-500">With Active Orders</p>
              <p className="text-xl font-bold text-gray-900">{customers.filter(c => c.activeOrderCount > 0).length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600"><ShoppingBag size={20} /></div>
            <div>
              <p className="text-sm text-gray-500">Repeat Customers</p>
              <p className="text-xl font-bold text-gray-900">{customers.filter(c => c.totalOrders > 1).length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search name, phone, address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </form>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: 'customerName', label: 'Customer Name' },
                    { key: 'customerPhone', label: 'Phone Number' },
                    { key: 'customerAddress', label: 'Address' },
                    { key: 'totalOrders', label: 'Total Orders' },
                    { key: 'activeOrderCount', label: 'Active Orders' },
                    { key: null, label: '' },
                  ].map(col => (
                    <th
                      key={col.label || 'actions'}
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
                {sorted.map((customer, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {customer.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{customer.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone size={13} />
                        {customer.customerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-gray-600 max-w-xs truncate">
                        <MapPin size={13} className="mt-0.5 shrink-0" />
                        <span className="truncate">{customer.customerAddress}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {customer.totalOrders}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {customer.activeOrderCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {customer.activeOrderCount}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/customers/${encodeURIComponent(customer.customerPhone)}`}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No customers found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {sorted.length} customer{sorted.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
