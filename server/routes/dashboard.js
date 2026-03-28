const express = require('express');
const router = express.Router();
const { getAllOrders } = require('../services/sheets');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const orders = await getAllOrders();

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.pricePaid, 0);
    const totalProfit = orders.reduce((sum, o) => sum + o.profit, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const returnedOrders = orders.filter(o => o.orderStatus === 'Returned').length;
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

    // Orders by source
    const ordersBySource = {};
    orders.forEach(o => {
      ordersBySource[o.orderFrom] = (ordersBySource[o.orderFrom] || 0) + 1;
    });

    // Order status breakdown
    const statusBreakdown = {};
    orders.forEach(o => {
      statusBreakdown[o.orderStatus] = (statusBreakdown[o.orderStatus] || 0) + 1;
    });

    // Payment mode distribution
    const paymentDistribution = {};
    orders.forEach(o => {
      paymentDistribution[o.modeOfPayment] = (paymentDistribution[o.modeOfPayment] || 0) + 1;
    });

    // Revenue over time (grouped by date)
    const revenueByDate = {};
    const profitByDate = {};
    orders.forEach(o => {
      const date = o.orderDate || 'Unknown';
      revenueByDate[date] = (revenueByDate[date] || 0) + o.pricePaid;
      profitByDate[date] = (profitByDate[date] || 0) + o.profit;
    });

    // Convert to sorted arrays for charts
    const revenueOverTime = Object.entries(revenueByDate)
      .map(([date, revenue]) => ({ date, revenue, profit: profitByDate[date] || 0 }))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));

    res.json({
      success: true,
      data: {
        kpis: {
          totalOrders,
          totalRevenue,
          totalProfit,
          avgOrderValue,
          returnRate,
        },
        ordersBySource: Object.entries(ordersBySource).map(([name, value]) => ({ name, value })),
        statusBreakdown: Object.entries(statusBreakdown).map(([name, value]) => ({ name, value })),
        paymentDistribution: Object.entries(paymentDistribution).map(([name, value]) => ({ name, value })),
        revenueOverTime,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error.message);
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
