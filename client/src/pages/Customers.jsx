import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, RefreshCw, User, Phone, MapPin, Mail, ShoppingBag, Zap, Plus, X, Archive } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { addCustomer, archiveCustomer } from '../services/api';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

function AddCustomerModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName || !form.customerPhone) {
      setError('Name and phone are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addCustomer(form);
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Customer name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input type="text" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Phone number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Email address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Delivery address" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Customers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasActiveOrdersParam = searchParams.get('hasActiveOrders') === 'true';

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { customers, loading, error, refresh } = useCustomers(query, 'Active', hasActiveOrdersParam);
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiving, setArchiving] = useState(null);

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

  const handleArchive = async (customer) => {
    if (!window.confirm(`Archive ${customer.customerName}? They will be moved to the archived list.`)) return;
    setArchiving(customer.customerPhone);
    try {
      await archiveCustomer(customer.customerPhone);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setArchiving(null);
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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <button onClick={refresh} className="p-1.5 rounded-lg text-gray-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/customers/archived" className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Archive size={16} />
            <span className="hidden md:inline">Archived</span>
          </Link>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
            <Plus size={16} />
            <span className="hidden md:inline">Add Customer</span>
          </button>
        </div>
      </div>

      {/* Active filter badge */}
      {hasActiveOrdersParam && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full px-3 py-1 font-medium">
            <Zap size={12} />
            Showing: Active Customers only
            <button
              onClick={() => navigate('/customers')}
              className="ml-1 hover:text-green-900"
              aria-label="Clear filter"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-terracotta-50 text-terracotta-600"><User size={20} /></div>
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
          placeholder="Search name, phone, email, address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
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
                    { key: 'customerEmail', label: 'Email' },
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
                      {sortField === col.key && (sortDir === 'asc' ? ' \u2191' : ' \u2193')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((customer, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center text-xs font-bold">
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
                      {customer.customerEmail ? (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Mail size={13} />
                          <span className="truncate max-w-[180px]">{customer.customerEmail}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
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
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/customers/${encodeURIComponent(customer.customerPhone)}`}
                          className="text-sm text-terracotta-600 hover:text-terracotta-800 font-medium"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleArchive(customer)}
                          disabled={archiving === customer.customerPhone}
                          className="text-sm text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                          title="Archive customer"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No customers found</td>
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

      {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onAdded={refresh} />}
    </div>
  );
}
