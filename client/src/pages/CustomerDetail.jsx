import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Mail, ShoppingBag, IndianRupee, Zap, Pencil, X, Check, Archive } from 'lucide-react';
import { fetchCustomerByPhone, updateOrderStatus, updateCustomer, archiveCustomer } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import StatusSelect from '../components/StatusSelect';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency } from '../utils/formatters';

export default function CustomerDetail() {
  const { phone } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCustomerByPhone(phone)
      .then(setCustomer)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [phone]);

  const handleStatusUpdate = async (rowIndex, newStatus) => {
    await updateOrderStatus(rowIndex, newStatus);
    setCustomer(prev => ({
      ...prev,
      orders: prev.orders.map(o =>
        o.rowIndex === rowIndex ? { ...o, orderStatus: newStatus } : o
      ),
    }));
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive ${customer.customerName}? They will be moved to the archived list.`)) return;
    setArchiving(true);
    try {
      await archiveCustomer(customer.customerPhone);
      navigate('/customers');
    } catch (err) {
      alert(err.message);
      setArchiving(false);
    }
  };

  const startEditing = () => {
    setEditForm({
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      customerAddress: customer.customerAddress,
      customerEmail: customer.customerEmail || '',
    });
    setEditing(true);
    setEditError('');
  };

  const handleSave = async () => {
    if (!editForm.customerName || !editForm.customerPhone) {
      setEditError('Name and phone are required');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await updateCustomer(phone, editForm);
      setCustomer(prev => ({ ...prev, ...editForm }));
      setEditing(false);
      // If phone changed, navigate to new URL
      if (editForm.customerPhone !== phone) {
        navigate(`/customers/${encodeURIComponent(editForm.customerPhone)}`, { replace: true });
      }
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!customer) return null;

  const activeStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];
  const activeOrders = customer.orders.filter(o => activeStatuses.includes(o.orderStatus));
  const pastOrders = customer.orders.filter(o => !activeStatuses.includes(o.orderStatus));

  return (
    <div className="p-6 space-y-6">
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} />
        Back to Customers
      </Link>

      {/* Customer Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center text-lg font-bold">
            {customer.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input type="text" value={editForm.customerName} onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full max-w-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input type="text" value={editForm.customerPhone} onChange={e => setEditForm({ ...editForm, customerPhone: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full max-w-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input type="email" value={editForm.customerEmail} onChange={e => setEditForm({ ...editForm, customerEmail: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full max-w-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Address</label>
                  <input type="text" value={editForm.customerAddress} onChange={e => setEditForm({ ...editForm, customerAddress: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full max-w-md" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                    <Check size={14} />{saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    <X size={14} />Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">{customer.customerName}</h1>
                  <button onClick={startEditing} className="text-gray-400 hover:text-terracotta-600 transition-colors" title="Edit customer">
                    <Pencil size={16} />
                  </button>
                  <button onClick={handleArchive} disabled={archiving} className="text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50" title="Archive customer">
                    <Archive size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><Phone size={14} />{customer.customerPhone}</span>
                  {customer.customerEmail && (
                    <span className="flex items-center gap-1.5"><Mail size={14} />{customer.customerEmail}</span>
                  )}
                  <span className="flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" />{customer.customerAddress}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <ShoppingBag size={18} className="text-terracotta-600" />
            <div>
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-lg font-bold text-gray-900">{customer.totalOrders}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Zap size={18} className="text-green-600" />
            <div>
              <p className="text-xs text-gray-500">Active Orders</p>
              <p className="text-lg font-bold text-gray-900">{customer.activeOrderCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <IndianRupee size={18} className="text-amber-600" />
            <div>
              <p className="text-xs text-gray-500">Total Spent</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(customer.totalSpent)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <IndianRupee size={18} className="text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">Avg Order</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Active Orders ({activeOrders.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeOrders.map(order => (
                  <tr key={order.rowIndex} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.productOrdered}</td>
                    <td className="px-4 py-3 text-gray-600">{order.modeOfPayment}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        currentStatus={order.orderStatus}
                        onUpdate={(status) => handleStatusUpdate(order.rowIndex, status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past Orders */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Order History ({pastOrders.length})
        </h2>
        {pastOrders.length === 0 ? (
          <p className="text-sm text-gray-500">No past orders</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pastOrders.map(order => (
                  <tr key={order.rowIndex} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.productOrdered}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                        {order.orderFrom}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.orderStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
