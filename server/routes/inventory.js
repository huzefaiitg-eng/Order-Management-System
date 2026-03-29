const express = require('express');
const router = express.Router();
const {
  getAllInventory, getProductByArticleId, getAllOrders,
  addProduct, updateProduct, archiveProduct, unarchiveProduct, deleteProduct,
} = require('../services/sheets');

const LOW_STOCK_THRESHOLD = 5;

// GET /api/inventory/summary — MUST be before /:articleId
router.get('/summary', async (req, res) => {
  try {
    const products = await getAllInventory();
    const activeProducts = products.filter(p => p.status === 'Active' || !p.status);

    const totalProducts = activeProducts.length;
    const totalInventoryValue = activeProducts.reduce((sum, p) => sum + (p.productCost * p.instockQuantity), 0);
    const lowStockCount = activeProducts.filter(p => p.availableQuantity > 0 && p.availableQuantity < LOW_STOCK_THRESHOLD).length;
    const outOfStockCount = activeProducts.filter(p => p.instockQuantity === 0).length;

    const categoryBreakdown = {};
    activeProducts.forEach(p => {
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

// POST /api/inventory — add a new product (MUST be before /:articleId)
router.post('/', async (req, res) => {
  try {
    const { productName, category, subCategory, productCost, instockQuantity, productDescription, productImages } = req.body;

    if (!productName || !category || !subCategory || productCost === undefined || instockQuantity === undefined) {
      return res.status(400).json({ success: false, error: 'Product name, category, sub-category, cost, and instock quantity are required' });
    }

    const newProduct = await addProduct({
      productName,
      productDescription,
      category,
      subCategory,
      productImages,
      productCost: parseFloat(productCost),
      instockQuantity: parseInt(instockQuantity),
    });

    res.json({ success: true, data: newProduct });
  } catch (error) {
    console.error('Error adding product:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const [products, orders] = await Promise.all([getAllInventory(), getAllOrders()]);

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

    // Filter by status (default: Active)
    const statusFilter = req.query.status || 'Active';
    result = result.filter(p => p.status === statusFilter);

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

// PATCH /api/inventory/:articleId/archive — MUST be before /:articleId
router.patch('/:articleId/archive', async (req, res) => {
  try {
    const articleId = decodeURIComponent(req.params.articleId);
    const updated = await archiveProduct(articleId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error archiving product:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// PATCH /api/inventory/:articleId/unarchive — MUST be before /:articleId
router.patch('/:articleId/unarchive', async (req, res) => {
  try {
    const articleId = decodeURIComponent(req.params.articleId);
    const updated = await unarchiveProduct(articleId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error unarchiving product:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// DELETE /api/inventory/:articleId — MUST be before /:articleId GET
router.delete('/:articleId', async (req, res) => {
  try {
    const articleId = decodeURIComponent(req.params.articleId);
    await deleteProduct(articleId);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting product:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
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

// PATCH /api/inventory/:articleId — update product details
router.patch('/:articleId', async (req, res) => {
  try {
    const articleId = decodeURIComponent(req.params.articleId);
    const updates = req.body;

    if (updates.productCost !== undefined) updates.productCost = parseFloat(updates.productCost);
    if (updates.instockQuantity !== undefined) updates.instockQuantity = parseInt(updates.instockQuantity);

    const updated = await updateProduct(articleId, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating product:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
