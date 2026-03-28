const express = require('express');
const router = express.Router();
const { getAllInventory, getProductByArticleId, getAllOrders } = require('../services/sheets');

const LOW_STOCK_THRESHOLD = 5;

// GET /api/inventory/summary — MUST be before /:articleId
router.get('/summary', async (req, res) => {
  try {
    const [products, orders] = await Promise.all([getAllInventory(), getAllOrders()]);

    const totalProducts = products.length;
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.productCost * p.instockQuantity), 0);
    const lowStockCount = products.filter(p => p.availableQuantity > 0 && p.availableQuantity < LOW_STOCK_THRESHOLD).length;
    const outOfStockCount = products.filter(p => p.instockQuantity === 0).length;

    // Category breakdown
    const categoryBreakdown = {};
    products.forEach(p => {
      if (!categoryBreakdown[p.category]) {
        categoryBreakdown[p.category] = { count: 0, value: 0 };
      }
      categoryBreakdown[p.category].count++;
      categoryBreakdown[p.category].value += p.productCost * p.instockQuantity;
    });

    res.json({
      success: true,
      data: { totalProducts, totalInventoryValue, lowStockCount, outOfStockCount, categoryBreakdown },
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const [products, orders] = await Promise.all([getAllInventory(), getAllOrders()]);

    // Compute per-product order stats
    const productStats = {};
    orders.forEach(order => {
      const name = order.productOrdered;
      if (!name) return;
      if (!productStats[name]) {
        productStats[name] = { totalOrders: 0, totalRevenue: 0, returnedCount: 0 };
      }
      productStats[name].totalOrders++;
      productStats[name].totalRevenue += order.pricePaid;
      if (order.orderStatus === 'Returned') {
        productStats[name].returnedCount++;
      }
    });

    let result = products.map(p => {
      const stats = productStats[p.productName] || { totalOrders: 0, totalRevenue: 0, returnedCount: 0 };
      return {
        ...p,
        totalOrders: stats.totalOrders,
        totalRevenue: stats.totalRevenue,
        returnedCount: stats.returnedCount,
      };
    });

    const { search, category, subCategory } = req.query;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.productName.toLowerCase().includes(q) ||
        p.articleId.toLowerCase().includes(q) ||
        p.productDescription.toLowerCase().includes(q)
      );
    }
    if (category) {
      result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (subCategory) {
      result = result.filter(p => p.subCategory.toLowerCase() === subCategory.toLowerCase());
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching inventory:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/:articleId
router.get('/:articleId', async (req, res) => {
  try {
    const articleId = decodeURIComponent(req.params.articleId);
    const [product, orders] = await Promise.all([
      getProductByArticleId(articleId),
      getAllOrders(),
    ]);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const productOrders = orders.filter(o => o.productOrdered === product.productName);
    const totalRevenue = productOrders.reduce((sum, o) => sum + o.pricePaid, 0);
    const totalProfit = productOrders.reduce((sum, o) => sum + o.profit, 0);
    const returnedCount = productOrders.filter(o => o.orderStatus === 'Returned').length;

    res.json({
      success: true,
      data: {
        ...product,
        totalOrders: productOrders.length,
        totalRevenue,
        totalProfit,
        returnRate: productOrders.length > 0 ? returnedCount / productOrders.length : 0,
        averageMargin: productOrders.length > 0 ? totalProfit / productOrders.length : 0,
        orders: productOrders,
      },
    });
  } catch (error) {
    console.error('Error fetching product:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
