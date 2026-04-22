const express = require('express');
const router = express.Router();
const { getAllLeads, getLeadById, addLead, updateLead, deleteLead } = require('../services/leadsSheets');

const VALID_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];
const VALID_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    let leads = await getAllLeads(sheetId);

    const { status, source, search } = req.query;

    if (status) {
      leads = leads.filter(l => l.leadStatus === status);
    }
    if (source) {
      leads = leads.filter(l => l.leadSource === source);
    }
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l =>
        l.customerName.toLowerCase().includes(q) ||
        l.customerPhone.includes(q) ||
        l.productsInterested.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q)
      );
    }

    // Sort: newest first (by createdAt, fallback to leadDate)
    leads.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('Error fetching leads:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/leads
router.post('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const {
      customerName, customerPhone, customerEmail,
      productsInterested, leadStatus, leadSource,
      followUpDate, budget, notes,
    } = req.body;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ success: false, error: 'Customer name and phone are required' });
    }
    if (leadStatus && !VALID_STATUSES.includes(leadStatus)) {
      return res.status(400).json({ success: false, error: `Invalid lead status: ${leadStatus}` });
    }

    const lead = await addLead(sheetId, {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail?.trim() || '',
      productsInterested: productsInterested || '',
      leadStatus: leadStatus || 'New Lead',
      leadSource: leadSource || '',
      followUpDate: followUpDate || '',
      budget: parseFloat(budget) || 0,
      notes: notes || '',
    });

    // Re-fetch to get proper rowIndex
    const allLeads = await getAllLeads(sheetId);
    const saved = allLeads.find(l => l.leadId === lead.leadId) || lead;

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Error creating lead:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/leads/:leadId
router.get('/:leadId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const lead = await getLeadById(sheetId, req.params.leadId);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (error) {
    console.error('Error fetching lead:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/leads/:leadId
router.patch('/:leadId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const updates = req.body;

    if (updates.leadStatus && !VALID_STATUSES.includes(updates.leadStatus)) {
      return res.status(400).json({ success: false, error: `Invalid lead status: ${updates.leadStatus}` });
    }

    const updated = await updateLead(sheetId, req.params.leadId, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating lead:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// DELETE /api/leads/:leadId
router.delete('/:leadId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const result = await deleteLead(sheetId, req.params.leadId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting lead:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
