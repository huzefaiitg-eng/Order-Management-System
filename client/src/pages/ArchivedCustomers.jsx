import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, User, Phone, Mail, MapPin, RotateCcw, Trash2 } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { unarchiveCustomer, deleteCustomer } from '../services/api';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

export default function ArchivedCustomers() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { customers, loading, error, refresh } = useCustomers(query, 'Archived');
  const [actionLoading, setActionLoading] = useState(null);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(search);
  };

  const handleUnarchive = async (customer) => {
    if (!window.confirm(`Unarchive ${customer.customerName}? They will be moved back to the active list.`)) return;
    setActionLoading(customer.customerPhone + '_unarchive');
    try {
      await unarchiveCustomer(customer.customerPhone);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Permanently delete ${customer.customerName}? This cannot be undone and will remove them from the Google Sheet.`)) return;
    setActionLoading(customer.customerPhone + '_delete');
    try {
      await deleteCustomer(customer.customerPhone);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} />
        Back to Active Customers
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Archived Customers</h1>
        <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {!loading && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <User size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            {customers.length} archived customer{customers.length !== 1 ? 's' : ''}. Unarchive to restore or permanently delete.
          </p>
        </div>
      )}

      <form onSubmit={handleSearch} className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search archived customers..."
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Customer Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Phone Number</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">
                          {customer.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-700">{customer.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Phone size={13} />
                        {customer.customerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {customer.customerEmail ? (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Mail size={13} />
                          <span className="truncate max-w-[180px]">{customer.customerEmail}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-gray-500 max-w-xs">
                        <MapPin size={13} className="mt-0.5 shrink-0" />
                        <span className="truncate">{customer.customerAddress}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUnarchive(customer)}
                          disabled={actionLoading === customer.customerPhone + '_unarchive'}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          <RotateCcw size={13} />
                          Unarchive
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          disabled={actionLoading === customer.customerPhone + '_delete'}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No archived customers</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {customers.length} archived customer{customers.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
