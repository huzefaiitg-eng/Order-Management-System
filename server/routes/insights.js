const express = require('express');
const router = express.Router();
const { getAllOrders, getAllInventory } = require('../services/sheets');

const DELAYED_THRESHOLD_DAYS = 3;
const LOW_MARGIN_THRESHOLD = 0.1; // 10%
const CHURN_DAYS_THRESHOLD = 60;
const LOW_STOCK_THRESHOLD = 5;
const HIGH_RETURN_RATE_THRESHOLD = 0.2; // 20%

// GET /api/insights
router.get('/', async (req, res) => {
  try {
    const [orders, inventory] = await Promise.all([getAllOrders(), getAllInventory()]);
    const now = new Date();
    const terminalStatuses = ['Delivered', 'Returned', 'Cancelled', 'Refunded'];
    const activeStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];

    // ========== ORDER INSIGHTS ==========

    // 1. COD Payment follow-ups: COD orders that are delivered
    const codFollowUps = orders.filter(
      o => o.modeOfPayment === 'COD' && o.orderStatus === 'Delivered'
    );

    // 2. Delayed orders: stuck in non-terminal status for too long
    const delayedOrders = orders.filter(o => {
      if (terminalStatuses.includes(o.orderStatus)) return false;
      const orderDate = parseDate(o.orderDate);
      const daysSinceOrder = (now - orderDate) / (1000 * 60 * 60 * 24);
      return daysSinceOrder > DELAYED_THRESHOLD_DAYS;
    });

    // 3. Repeat customers
    const customerOrders = {};
    orders.forEach(o => {
      const key = o.customerPhone || o.customerName;
      if (!customerOrders[key]) {
        customerOrders[key] = { name: o.customerName, phone: o.customerPhone, orders: [] };
      }
      customerOrders[key].orders.push(o);
    });
    const repeatCustomers = Object.values(customerOrders)
      .filter(c => c.orders.length > 1)
      .map(c => ({
        customerName: c.name,
        customerPhone: c.phone,
        orderCount: c.orders.length,
        totalSpent: c.orders.reduce((sum, o) => sum + o.pricePaid, 0),
      }))
      .sort((a, b) => b.orderCount - a.orderCount);

    // 4. Low margin alerts
    const lowMarginOrders = orders.filter(o => {
      if (o.pricePaid === 0) return false;
      const margin = o.profit / o.pricePaid;
      return margin < LOW_MARGIN_THRESHOLD;
    });

    // ========== CUSTOMER INSIGHTS ==========

    // 5. High-value customers — Top 10 spenders
    const highValueCustomers = Object.values(customerOrders)
      .map(c => ({
        customerName: c.name,
        customerPhone: c.phone,
        orderCount: c.orders.length,
        totalSpent: c.orders.reduce((sum, o) => sum + o.pricePaid, 0),
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // 6. Churn risk — customers whose last order > 60 days ago
    const churnRiskCustomers = Object.values(customerOrders)
      .map(c => {
        const dates = c.orders.map(o => parseDate(o.orderDate));
        const lastDate = new Date(Math.max(...dates));
        const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        return {
          customerName: c.name,
          customerPhone: c.phone,
          lastOrderDate: c.orders.reduce((latest, o) => {
            return parseDate(o.orderDate) > parseDate(latest.orderDate) ? o : latest;
          }).orderDate,
          daysSinceLastOrder: daysSince,
          totalOrders: c.orders.length,
        };
      })
      .filter(c => c.daysSinceLastOrder > CHURN_DAYS_THRESHOLD)
      .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

    // 7. Attention needed — customers with delayed/stuck orders
    const attentionNeededCustomers = Object.values(customerOrders)
      .map(c => {
        const delayed = c.orders.filter(o => {
          if (terminalStatuses.includes(o.orderStatus)) return false;
          const daysSince = (now - parseDate(o.orderDate)) / (1000 * 60 * 60 * 24);
          return daysSince > DELAYED_THRESHOLD_DAYS;
        });
        return {
          customerName: c.name,
          customerPhone: c.phone,
          delayedOrderCount: delayed.length,
          orders: delayed,
        };
      })
      .filter(c => c.delayedOrderCount > 0)
      .sort((a, b) => b.delayedOrderCount - a.delayedOrderCount);

    // 8. Customer return rates — customers with high return rate (min 2 orders)
    const customerReturnRates = Object.values(customerOrders)
      .filter(c => c.orders.length >= 2)
      .map(c => {
        const returned = c.orders.filter(o => o.orderStatus === 'Returned').length;
        return {
          customerName: c.name,
          customerPhone: c.phone,
          totalOrders: c.orders.length,
          returnedOrders: returned,
          returnRate: returned / c.orders.length,
        };
      })
      .filter(c => c.returnRate > 0.3)
      .sort((a, b) => b.returnRate - a.returnRate);

    // ========== INVENTORY INSIGHTS ==========

    // 9. Low stock alerts
    const lowStockAlerts = inventory
      .filter(p => p.instockQuantity > 0 && p.availableQuantity < LOW_STOCK_THRESHOLD)
      .map(p => ({
        articleId: p.articleId,
        productName: p.productName,
        category: p.category,
        instockQuantity: p.instockQuantity,
        availableQuantity: p.availableQuantity,
      }));

    // 10. Out of stock products
    const outOfStockProducts = inventory
      .filter(p => p.instockQuantity === 0)
      .map(p => ({
        articleId: p.articleId,
        productName: p.productName,
        category: p.category,
        subCategory: p.subCategory,
      }));

    // 11. Best selling products — top 10 by order count
    const productOrderStats = {};
    orders.forEach(o => {
      const name = o.productOrdered;
      if (!name) return;
      if (!productOrderStats[name]) {
        productOrderStats[name] = { totalOrders: 0, totalRevenue: 0 };
      }
      productOrderStats[name].totalOrders++;
      productOrderStats[name].totalRevenue += o.pricePaid;
    });

    const productLookup = {};
    inventory.forEach(p => { productLookup[p.productName] = p; });

    const bestSellingProducts = Object.entries(productOrderStats)
      .map(([name, stats]) => ({
        productName: name,
        articleId: productLookup[name]?.articleId || '',
        orderCount: stats.totalOrders,
        totalRevenue: stats.totalRevenue,
        instockQuantity: productLookup[name]?.instockQuantity ?? 0,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    // 12. Slow moving inventory — high stock but few orders
    const slowMovingInventory = inventory
      .filter(p => p.instockQuantity > 10)
      .map(p => ({
        articleId: p.articleId,
        productName: p.productName,
        category: p.category,
        instockQuantity: p.instockQuantity,
        orderCount: productOrderStats[p.productName]?.totalOrders || 0,
      }))
      .filter(p => p.orderCount < 2)
      .sort((a, b) => b.instockQuantity - a.instockQuantity);

    // 13. High return products — products with > 20% return rate
    const highReturnProducts = Object.entries(productOrderStats)
      .filter(([, stats]) => stats.totalOrders >= 2)
      .map(([name, stats]) => {
        const returned = orders.filter(o => o.productOrdered === name && o.orderStatus === 'Returned').length;
        return {
          productName: name,
          articleId: productLookup[name]?.articleId || '',
          totalOrders: stats.totalOrders,
          returnedOrders: returned,
          returnRate: returned / stats.totalOrders,
        };
      })
      .filter(p => p.returnRate > HIGH_RETURN_RATE_THRESHOLD)
      .sort((a, b) => b.returnRate - a.returnRate);

    res.json({
      success: true,
      data: {
        // Order insights
        codFollowUps,
        delayedOrders,
        repeatCustomers,
        lowMarginOrders,
        // Customer insights
        highValueCustomers,
        churnRiskCustomers,
        attentionNeededCustomers,
        customerReturnRates,
        // Inventory insights
        lowStockAlerts,
        outOfStockProducts,
        bestSellingProducts,
        slowMovingInventory,
        highReturnProducts,
      },
    });
  } catch (error) {
    console.error('Error fetching insights:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(dateStr);
}

module.exports = router;
