const express = require('express');
const router = express.Router();
const { getAllOrders, getAllInventory, getAllInventoryAuditEntries } = require('../services/sheets');

const DELAYED_THRESHOLD_DAYS = 3;
const LOW_MARGIN_THRESHOLD = 0.1;
const CHURN_DAYS_THRESHOLD = 60;
const HIGH_RETURN_RATE_THRESHOLD = 0.2;

// GET /api/insights?scope=orders|customers|inventory (default: all)
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const scope = req.query.scope || 'all';

    const needsOrders = scope === 'all' || scope === 'orders' || scope === 'customers' || scope === 'inventory';
    const needsInventory = scope === 'all' || scope === 'inventory';
    const needsInventoryAudit = scope === 'all' || scope === 'inventory';

    const [orders, inventory, inventoryAuditEntries] = await Promise.all([
      needsOrders ? getAllOrders(sheetId) : Promise.resolve([]),
      needsInventory ? getAllInventory(sheetId) : Promise.resolve([]),
      needsInventoryAudit ? getAllInventoryAuditEntries(sheetId).catch(() => []) : Promise.resolve([]),
    ]);

    const now = new Date();
    const terminalStatuses = ['Delivered', 'Returned', 'Cancelled', 'Refunded'];
    const isActiveOrder = (s) => s && !terminalStatuses.includes(String(s).trim());

    // ── Customer aggregation (used by orders + customers scopes) ──────────
    let customerOrders = {};
    if (scope === 'all' || scope === 'orders' || scope === 'customers') {
      orders.forEach(o => {
        const key = o.customerPhone || o.customerName;
        if (!customerOrders[key]) customerOrders[key] = { name: o.customerName, phone: o.customerPhone, orders: [] };
        customerOrders[key].orders.push(o);
      });
    }

    // ── Product stats (used by inventory scope) ───────────────────────────
    let productOrderStats = {};
    let enrichedInventory = [];
    let productLookup = {};
    if (scope === 'all' || scope === 'inventory') {
      const activeQtyByProduct = {};
      orders.forEach(o => {
        if (!isActiveOrder(o.orderStatus)) return;
        (o.productLines || []).forEach(line => {
          if (!line.productName) return;
          activeQtyByProduct[line.productName] = (activeQtyByProduct[line.productName] || 0) + (line.quantity || 1);
        });
      });

      enrichedInventory = inventory.filter(p => p.status === 'Active' || !p.status).map(p => ({
        ...p,
        quantityInActiveOrders: activeQtyByProduct[p.productName] || 0,
        availableQuantity: p.instockQuantity,
      }));

      orders.forEach(o => {
        (o.productLines || []).forEach(line => {
          const name = line.productName;
          if (!name) return;
          if (!productOrderStats[name]) productOrderStats[name] = { totalOrders: 0, totalRevenue: 0, returnedOrders: 0 };
          productOrderStats[name].totalOrders++;
          productOrderStats[name].totalRevenue += line.sellingLineTotal || line.lineTotal || 0;
          if (o.orderStatus === 'Returned') productOrderStats[name].returnedOrders++;
        });
      });

      enrichedInventory.forEach(p => { productLookup[p.productName] = p; });

      // Orders placed in the last 30 days per product (urgency signal for restocking)
      const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      var orders30dByProduct = {};
      orders.forEach(o => {
        if (parseDate(o.orderDate) >= cutoff30d) {
          (o.productLines || []).forEach(line => {
            if (!line.productName) return;
            orders30dByProduct[line.productName] = (orders30dByProduct[line.productName] || 0) + 1;
          });
        }
      });

      // "Out of stock since" — find the most recent audit entry where newQty === 0 per articleId
      // Entries are sorted ascending by changedAt, so iterating forwards gives us the latest per product
      var outOfStockSinceByProduct = {};
      inventoryAuditEntries.forEach(entry => {
        if (entry.newQty === 0 && entry.articleId) {
          outOfStockSinceByProduct[entry.articleId] = entry.changedAt;
        }
      });
    }

    const result = {};

    // ── Order Insights ────────────────────────────────────────────────────
    if (scope === 'all' || scope === 'orders') {
      result.codFollowUps = orders.filter(o => o.modeOfPayment === 'COD' && o.orderStatus === 'Delivered');

      result.delayedOrders = orders.filter(o => {
        if (terminalStatuses.includes(o.orderStatus)) return false;
        const daysSinceOrder = (now - parseDate(o.orderDate)) / (1000 * 60 * 60 * 24);
        return daysSinceOrder > DELAYED_THRESHOLD_DAYS;
      });

      result.repeatCustomers = Object.values(customerOrders)
        .filter(c => c.orders.length > 1)
        .map(c => ({ customerName: c.name, customerPhone: c.phone, orderCount: c.orders.length, totalSpent: c.orders.reduce((sum, o) => sum + o.pricePaid, 0) }))
        .sort((a, b) => b.orderCount - a.orderCount);

      result.lowMarginOrders = orders.filter(o => {
        if (o.pricePaid === 0) return false;
        return o.profit / o.pricePaid < LOW_MARGIN_THRESHOLD;
      });
    }

    // ── Customer Insights ─────────────────────────────────────────────────
    if (scope === 'all' || scope === 'customers') {
      result.highValueCustomers = Object.values(customerOrders)
        .map(c => ({ customerName: c.name, customerPhone: c.phone, orderCount: c.orders.length, totalSpent: c.orders.reduce((sum, o) => sum + o.pricePaid, 0) }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      result.churnRiskCustomers = Object.values(customerOrders)
        .map(c => {
          const dates = c.orders.map(o => parseDate(o.orderDate));
          const lastDate = new Date(Math.max(...dates));
          const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
          return {
            customerName: c.name, customerPhone: c.phone,
            lastOrderDate: c.orders.reduce((latest, o) => parseDate(o.orderDate) > parseDate(latest.orderDate) ? o : latest).orderDate,
            daysSinceLastOrder: daysSince, totalOrders: c.orders.length,
          };
        })
        .filter(c => c.daysSinceLastOrder > CHURN_DAYS_THRESHOLD)
        .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

      result.attentionNeededCustomers = Object.values(customerOrders)
        .map(c => {
          const delayed = c.orders.filter(o => {
            if (terminalStatuses.includes(o.orderStatus)) return false;
            return (now - parseDate(o.orderDate)) / (1000 * 60 * 60 * 24) > DELAYED_THRESHOLD_DAYS;
          });
          return { customerName: c.name, customerPhone: c.phone, delayedOrderCount: delayed.length };
        })
        .filter(c => c.delayedOrderCount > 0)
        .sort((a, b) => b.delayedOrderCount - a.delayedOrderCount);

      result.customerReturnRates = Object.values(customerOrders)
        .filter(c => c.orders.length >= 2)
        .map(c => {
          const returned = c.orders.filter(o => o.orderStatus === 'Returned').length;
          return { customerName: c.name, customerPhone: c.phone, totalOrders: c.orders.length, returnedOrders: returned, returnRate: returned / c.orders.length };
        })
        .filter(c => c.returnRate > 0.3)
        .sort((a, b) => b.returnRate - a.returnRate);
    }

    // ── Inventory Insights ────────────────────────────────────────────────
    if (scope === 'all' || scope === 'inventory') {
      result.lowStockAlerts = enrichedInventory
        .filter(p => p.instockQuantity > 0 && p.availableQuantity < (p.minStock || 5))
        .map(p => ({ articleId: p.articleId, productName: p.productName, category: p.category, instockQuantity: p.instockQuantity, availableQuantity: p.availableQuantity, minStock: p.minStock || 5, ordersLast30Days: orders30dByProduct[p.productName] || 0 }));

      result.outOfStockProducts = enrichedInventory
        .filter(p => p.instockQuantity === 0)
        .map(p => ({ articleId: p.articleId, productName: p.productName, category: p.category, subCategory: p.subCategory, ordersLast30Days: orders30dByProduct[p.productName] || 0, outOfStockSince: outOfStockSinceByProduct[p.articleId] || null }));

      const bestSellingProducts = Object.entries(productOrderStats)
        .map(([name, stats]) => ({
          productName: name,
          articleId: productLookup[name]?.articleId || '',
          orderCount: stats.totalOrders,
          totalRevenue: stats.totalRevenue,
          instockQuantity: productLookup[name]?.instockQuantity ?? 0,
          availableQuantity: productLookup[name]?.availableQuantity ?? 0,
          minStock: productLookup[name]?.minStock || 5,
        }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10);

      result.bestSellingProducts = bestSellingProducts;

      // Top sellers that are low stock or out of stock — urgent restocking needed
      result.topSellersAtRisk = bestSellingProducts
        .filter(p => p.availableQuantity < p.minStock)
        .map(p => ({
          articleId: p.articleId,
          productName: p.productName,
          orderCount: p.orderCount,
          availableQuantity: p.availableQuantity,
          minStock: p.minStock,
          isOutOfStock: p.availableQuantity === 0,
        }));

      result.slowMovingInventory = enrichedInventory
        .filter(p => p.instockQuantity > 10)
        .map(p => ({ articleId: p.articleId, productName: p.productName, category: p.category, instockQuantity: p.instockQuantity, orderCount: productOrderStats[p.productName]?.totalOrders || 0 }))
        .filter(p => p.orderCount < 2)
        .sort((a, b) => b.instockQuantity - a.instockQuantity);

      result.highReturnProducts = Object.entries(productOrderStats)
        .filter(([, stats]) => stats.totalOrders >= 2)
        .map(([name, stats]) => ({
          productName: name,
          articleId: productLookup[name]?.articleId || '',
          totalOrders: stats.totalOrders,
          returnedOrders: stats.returnedOrders,
          returnRate: stats.returnedOrders / stats.totalOrders,
        }))
        .filter(p => p.returnRate > HIGH_RETURN_RATE_THRESHOLD)
        .sort((a, b) => b.returnRate - a.returnRate);

      // Max stock alerts — products exceeding their max stock cap
      result.maxStockAlerts = enrichedInventory
        .filter(p => p.maxStock > 0 && p.instockQuantity > p.maxStock)
        .map(p => ({
          articleId: p.articleId,
          productName: p.productName,
          category: p.category,
          instockQuantity: p.instockQuantity,
          maxStock: p.maxStock,
          excess: p.instockQuantity - p.maxStock,
        }))
        .sort((a, b) => b.excess - a.excess);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching insights:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  return new Date(dateStr);
}

module.exports = router;
