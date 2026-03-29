import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Clock, Users, TrendingDown, Crown, UserX, Bell, RotateCcw,
  PackageMinus, PackageX, TrendingUp, Archive, ShoppingBag,
} from 'lucide-react';
import { useInsights } from '../hooks/useInsights';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, formatPercent } from '../utils/formatters';

function InsightSection({ icon: Icon, title, count, color, children }) {
  const colorMap = {
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    terracotta: 'bg-terracotta-50 text-terracotta-600 border-terracotta-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon size={18} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 flex-1">{title}</h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const TABS = [
  { key: 'orders', label: 'Order Insights', icon: ShoppingBag },
  { key: 'customers', label: 'Customer Insights', icon: Users },
  { key: 'inventory', label: 'Inventory Insights', icon: Archive },
];

export default function Insights() {
  const { data, loading, error } = useInsights();
  const [activeTab, setActiveTab] = useState('orders');

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Insights & Actions</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-terracotta-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order Insights */}
      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsightSection icon={AlertTriangle} title="COD Payment Follow-ups" count={data.codFollowUps?.length || 0} color="amber">
            {!data.codFollowUps?.length ? (
              <p className="text-sm text-gray-500">No COD follow-ups needed</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.codFollowUps.map(o => (
                  <Link key={o.rowIndex} to={`/orders/${o.rowIndex}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{o.customerName}</p>
                      <p className="text-xs text-gray-500">{o.productOrdered} - {o.orderDate}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(o.pricePaid)}</p>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={Clock} title="Delayed Orders" count={data.delayedOrders?.length || 0} color="red">
            {!data.delayedOrders?.length ? (
              <p className="text-sm text-gray-500">No delayed orders</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.delayedOrders.map(o => (
                  <Link key={o.rowIndex} to={`/orders/${o.rowIndex}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{o.customerName}</p>
                      <p className="text-xs text-gray-500">{o.productOrdered} - {o.orderDate}</p>
                    </div>
                    <StatusBadge status={o.orderStatus} />
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={Users} title="Repeat Customers" count={data.repeatCustomers?.length || 0} color="blue">
            {!data.repeatCustomers?.length ? (
              <p className="text-sm text-gray-500">No repeat customers yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.repeatCustomers.map((c, i) => (
                  <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                      <p className="text-xs text-gray-500">{c.customerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{c.orderCount} orders</p>
                      <p className="text-xs text-gray-500">Spent {formatCurrency(c.totalSpent)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={TrendingDown} title="Low Margin Orders" count={data.lowMarginOrders?.length || 0} color="orange">
            {!data.lowMarginOrders?.length ? (
              <p className="text-sm text-gray-500">No low-margin orders</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.lowMarginOrders.map(o => (
                  <Link key={o.rowIndex} to={`/orders/${o.rowIndex}`} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{o.productOrdered}</p>
                      <p className="text-xs text-gray-500">{o.customerName} - {o.orderDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(o.profit)}</p>
                      <p className="text-xs text-gray-500">Cost: {formatCurrency(o.productCost)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>
        </div>
      )}

      {/* Customer Insights */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsightSection icon={Crown} title="High-Value Customers" count={data.highValueCustomers?.length || 0} color="green">
            {!data.highValueCustomers?.length ? (
              <p className="text-sm text-gray-500">No data available</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.highValueCustomers.map((c, i) => (
                  <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                        <p className="text-xs text-gray-500">{c.orderCount} orders</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(c.totalSpent)}</p>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={UserX} title="Churn Risk" count={data.churnRiskCustomers?.length || 0} color="red">
            {!data.churnRiskCustomers?.length ? (
              <p className="text-sm text-gray-500">No churn risk customers detected</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.churnRiskCustomers.map((c, i) => (
                  <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                      <p className="text-xs text-gray-500">Last order: {c.lastOrderDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{c.daysSinceLastOrder}d ago</p>
                      <p className="text-xs text-gray-500">{c.totalOrders} orders total</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={Bell} title="Attention Needed" count={data.attentionNeededCustomers?.length || 0} color="amber">
            {!data.attentionNeededCustomers?.length ? (
              <p className="text-sm text-gray-500">All customers are on track</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.attentionNeededCustomers.map((c, i) => (
                  <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                      <p className="text-xs text-gray-500">{c.customerPhone}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
                      {c.delayedOrderCount} delayed
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={RotateCcw} title="High Return Rate Customers" count={data.customerReturnRates?.length || 0} color="orange">
            {!data.customerReturnRates?.length ? (
              <p className="text-sm text-gray-500">No customers with high return rates</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.customerReturnRates.map((c, i) => (
                  <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                      <p className="text-xs text-gray-500">{c.totalOrders} orders, {c.returnedOrders} returned</p>
                    </div>
                    <p className="text-sm font-bold text-orange-700">{formatPercent(c.returnRate * 100)} return</p>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>
        </div>
      )}

      {/* Inventory Insights */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsightSection icon={PackageMinus} title="Low Stock Alerts" count={data.lowStockAlerts?.length || 0} color="amber">
            {!data.lowStockAlerts?.length ? (
              <p className="text-sm text-gray-500">All products are well-stocked</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.lowStockAlerts.map((p, i) => (
                  <Link key={i} to={`/inventory/${encodeURIComponent(p.articleId)}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.productName}</p>
                      <p className="text-xs text-gray-500">{p.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-700">{p.availableQuantity} left</p>
                      <p className="text-xs text-gray-500">{p.instockQuantity} in stock</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={PackageX} title="Out of Stock" count={data.outOfStockProducts?.length || 0} color="red">
            {!data.outOfStockProducts?.length ? (
              <p className="text-sm text-gray-500">No products are out of stock</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.outOfStockProducts.map((p, i) => (
                  <Link key={i} to={`/inventory/${encodeURIComponent(p.articleId)}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.productName}</p>
                      <p className="text-xs text-gray-500">{p.category} - {p.subCategory}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-800">
                      Out of Stock
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={TrendingUp} title="Best Selling Products" count={data.bestSellingProducts?.length || 0} color="green">
            {!data.bestSellingProducts?.length ? (
              <p className="text-sm text-gray-500">No sales data yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.bestSellingProducts.map((p, i) => (
                  <Link key={i} to={p.articleId ? `/inventory/${encodeURIComponent(p.articleId)}` : '#'} className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.productName}</p>
                        <p className="text-xs text-gray-500">{p.orderCount} orders</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(p.totalRevenue)}</p>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={Archive} title="Slow Moving Inventory" count={data.slowMovingInventory?.length || 0} color="blue">
            {!data.slowMovingInventory?.length ? (
              <p className="text-sm text-gray-500">No slow-moving products detected</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.slowMovingInventory.map((p, i) => (
                  <Link key={i} to={`/inventory/${encodeURIComponent(p.articleId)}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.productName}</p>
                      <p className="text-xs text-gray-500">{p.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-700">{p.instockQuantity} in stock</p>
                      <p className="text-xs text-gray-500">{p.orderCount} orders</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>

          <InsightSection icon={RotateCcw} title="High Return Products" count={data.highReturnProducts?.length || 0} color="orange">
            {!data.highReturnProducts?.length ? (
              <p className="text-sm text-gray-500">No products with high return rates</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.highReturnProducts.map((p, i) => (
                  <Link key={i} to={p.articleId ? `/inventory/${encodeURIComponent(p.articleId)}` : '#'} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.productName}</p>
                      <p className="text-xs text-gray-500">{p.totalOrders} orders, {p.returnedOrders} returned</p>
                    </div>
                    <p className="text-sm font-bold text-orange-700">{formatPercent(p.returnRate * 100)} return</p>
                  </Link>
                ))}
              </div>
            )}
          </InsightSection>
        </div>
      )}
    </div>
  );
}
