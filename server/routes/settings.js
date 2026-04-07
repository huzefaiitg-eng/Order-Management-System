const express = require('express');
const router = express.Router();
const { getCategories, addCategorySetting, deleteCategorySetting, deleteCategoryAll } = require('../services/sheets');

// GET / — Fetch all categories and sub-categories
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const data = await getCategories(sheetId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / — Add a category-subcategory pair
router.post('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { category, subCategory } = req.body;

    if (!category || !subCategory) {
      return res.status(400).json({ success: false, error: 'Category and sub-category are required' });
    }

    const result = await addCategorySetting(sheetId, { category: category.trim(), subCategory: subCategory.trim() });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('already exists') ? 409 : 500).json({ success: false, error: err.message });
  }
});

// DELETE / — Delete a single category-subcategory pair
router.delete('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { category, subCategory } = req.body;

    if (!category || !subCategory) {
      return res.status(400).json({ success: false, error: 'Category and sub-category are required' });
    }

    const result = await deleteCategorySetting(sheetId, { category, subCategory });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /category — Delete an entire category and all its sub-categories
router.delete('/category', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }

    const result = await deleteCategoryAll(sheetId, category);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
