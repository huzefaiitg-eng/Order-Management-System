import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Package, CreditCard } from 'lucide-react';
import { fetchOrders, updateOrderStatus } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import StatusSelect from '../components/StatusSelect';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, ORDER_STATUSES } from '../utils/formatters';

const STATUS_FLOW = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

export default function OrderDetail() {
  const { rowIndex } = useParams();
  const [order, setOrder] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const allOrders = await fetchOrders();
        const current = allOrders.find(o => o.rowIndex === parseInt(rowIndex));
        if (!current) throw new Error('Order not found');
        setOrder(current);

        const related = allOrders.filter(
          o => o.rowIndex !== current.rowIndex &&
            (o.customerPhone === current.customerPhone || o.customerName === current.customerName)
        );
        setCustomerOrders(related);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [rowIndex]);

  const handleStatusUpdate = async (newStatus) => {
    await updateOrderStatus(order.rowIndex, newStatus);
    setOrder(prev => ({ ...prev, orderStatus: newStatus }));
  };

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!order) return null;

  const currentStatusIndex = STATUS_FLOW.indexOf(order.orderStatus);

  return (
    <div className="p-6 space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} />
        Back to Orders
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {order.articleId ? (
                  <Link to={`/inventory/${encodeURIComponent(order.articleId)}`} className="hover:text-indigo-600">
                    {order.productOrdered}
                  </Link>
                ) : order.productOrdered}
              </h1>
              {order.productDescription && (
                <p className="text-sm text-gray-500 mt-0.5">{order.productDescription}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">Order from {order.orderFrom} on {order.orderDate}</span>
              </div>
              {(order.category || order.subCategory) && (
                <div className="flex gap-2 mt-2">
                  {order.category && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {order.category}
                    </span>
                  )}
                  {order.subCategory && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {order.subCategory}
                    </span>
                  )}
                </div>
              )}
            </div>
            <StatusSelect currentStatus={order.orderStatus} onUpdate={handleStatusUpdate} />
          </div>

          {/* Status Timeline */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Progress</h2>
            <div className="flex items-center gap-1">
              {STATUS_FLOW.map((status, i) => {
                const isActive = i <= currentStatusIndex;
                const isCurrent = status === order.orderStatus;
                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent ? 'bg-indigo-600 text-white' :
                        isActive ? 'bg-green-500 text-white' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {isActive && !isCurrent ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] mt-1 text-center ${isCurrent ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>
                        {status}
                      </span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`h-0.5 w-full ${i < currentStatusIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {!STATUS_FLOW.includes(order.orderStatus) && (
              <div className="mt-3">
                <StatusBadge status={order.orderStatus} />
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Package size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Product Cost</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.productCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Price Paid</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.pricePaid)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Payment Mode</p>
                <p className="text-sm font-medium text-gray-900">{order.modeOfPayment}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Profit</p>
              <p className={`text-sm font-bold ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(order.profit)}
              </p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Customer</h2>
            <div>
              <p className="font-medium text-gray-900">{order.customerName}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={14} />
              {order.customerPhone}
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              {order.customerAddress}
            </div>
          </div>

          {/* Customer Order History */}
          {customerOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Other Orders ({customerOrders.length})
              </h2>
              <div className="space-y-3">
                {customerOrders.map(o => (
                  <Link
                    key={o.rowIndex}
                    to={`/orders/${o.rowIndex}`}
                    className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{o.productOrdered}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{o.orderDate}</span>
                      <StatusBadge status={o.orderStatus} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
