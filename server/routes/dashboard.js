const express = require('express');
const router = express.Router();
const { getAllOrders, getAllCustomers, getAllInventory } = require('../services/sheets');

// GET /api/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { startDate, endDate } = req.query;
    const [orders, customers, inventory] = await Promise.all([
      getAllOrders(sheetId),
      getAllCustomers(sheetId),
      getAllInventory(sheetId),
    ]);

    // Filter by date range if provided
    let filtered = orders;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      filtered = orders.filter(o => {
        const d = parseDate(o.orderDate);
        if (isNaN(d.getTime())) return false;
        return d >= start && d <= end;
      });
    }

    const totalOrders = filtered.length;
    const totalRevenue = filtered.reduce((sum, o) => sum + o.pricePaid, 0);
    const totalProfit = filtered.reduce((sum, o) => sum + o.profit, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const returnedOrders = filtered.filter(o => o.orderStatus === 'Returned').length;
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

    const ordersBySource = {};
    filtered.forEach(o => {
      ordersBySource[o.orderFrom] = (ordersBySource[o.orderFrom] || 0) + 1;
    });

    const statusBreakdown = {};
    filtered.forEach(o => {
      statusBreakdown[o.orderStatus] = (statusBreakdown[o.orderStatus] || 0) + 1;
    });

    const paymentDistribution = {};
    filtered.forEach(o => {
      paymentDistribution[o.modeOfPayment] = (paymentDistribution[o.modeOfPayment] || 0) + 1;
    });

    const revenueByDate = {};
    const profitByDate = {};
    filtered.forEach(o => {
      const date = o.orderDate || 'Unknown';
      revenueByDate[date] = (revenueByDate[date] || 0) + o.pricePaid;
      profitByDate[date] = (profitByDate[date] || 0) + o.profit;
    });

    const revenueOverTime = Object.entries(revenueByDate)
      .map(([date, revenue]) => ({ date, revenue, profit: profitByDate[date] || 0 }))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));

    res.json({
      success: true,
      data: {
        kpis: {
          totalOrders, totalRevenue, totalProfit, avgOrderValue, returnRate,
          totalCustomers: customers.filter(c => c.status !== 'Archived').length,
          totalInventory: inventory.filter(p => p.status !== 'Archived').length,
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
