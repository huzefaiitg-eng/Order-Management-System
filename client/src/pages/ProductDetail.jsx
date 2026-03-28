import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, ShoppingBag, IndianRupee, RotateCcw, TrendingUp } from 'lucide-react';
import { fetchProductByArticleId } from '../services/api';
import { formatCurrency, formatPercent } from '../utils/formatters';
import StockBadge from '../components/StockBadge';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

export default function ProductDetail() {
  const { articleId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchProductByArticleId(articleId)
      .then(setProduct)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!product) return null;

  return (
    <div className="p-6 space-y-6">
      <Link to="/inventory" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} />
        Back to Inventory
      </Link>

      {/* Product Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Package size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{product.productName}</h1>
              <span className="text-xs font-mono text-gray-400">{product.articleId}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{product.productDescription}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {product.category}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {product.subCategory}
              </span>
              <StockBadge quantity={product.availableQuantity} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <IndianRupee size={18} className="text-gray-600" />
            <div>
              <p className="text-xs text-gray-500">Cost Price</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(product.productCost)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Package size={18} className="text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">In Stock</p>
              <p className="text-lg font-bold text-gray-900">{product.instockQuantity}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <ShoppingBag size={18} className="text-indigo-600" />
            <div>
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-lg font-bold text-gray-900">{product.totalOrders}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <TrendingUp size={18} className="text-green-600" />
            <div>
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(product.totalRevenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <RotateCcw size={18} className="text-red-600" />
            <div>
              <p className="text-xs text-gray-500">Return Rate</p>
              <p className="text-lg font-bold text-gray-900">{formatPercent(product.returnRate * 100)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Order History ({product.orders.length})
        </h2>
        {product.orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders for this product yet</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Profit</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {product.orders.map(order => (
                    <tr key={order.rowIndex} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{order.customerName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                          {order.orderFrom}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                      <td className={`px-4 py-3 font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(order.profit)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={order.orderStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
