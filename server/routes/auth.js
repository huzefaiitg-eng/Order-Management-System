const express = require('express');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getUserByEmail, updateUserProfile, extractSheetId } = require('../services/userAccess');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await getUserByEmail(email);

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const sheetId = extractSheetId(user.orderSheetLink);
    if (!sheetId) {
      return res.status(500).json({ success: false, error: 'Invalid order sheet configuration for this user' });
    }

    const token = jwt.sign(
      { email: user.email, sheetId, hasInventoryAccess: user.hasInventoryAccess },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          name: user.name,
          companyName: user.companyName,
          email: user.email,
          phone: user.phone,
          address: user.address,
          website: user.website,
          hasInventoryAccess: user.hasInventoryAccess,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/profile (protected)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        name: user.name,
        companyName: user.companyName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        website: user.website,
        hasInventoryAccess: user.hasInventoryAccess,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/auth/profile (protected)
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, companyName, phone, address, website } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (companyName !== undefined) updates.companyName = companyName;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (website !== undefined) updates.website = website;

    const updated = await updateUserProfile(req.user.email, updates);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Profile update error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
