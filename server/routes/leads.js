const express = require('express');
const router = express.Router();
const {
  getAllLeads, getAllArchivedLeads, getLeadById, addLead, updateLead, deleteLead,
  archiveLead, unarchiveLead,
  getNextFollowUpPerLead, getFollowUpsForLead, addFollowUp, markFollowUpHappened,
} = require('../services/leadsSheets');

const VALID_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Converted', 'Lost'];
const VALID_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;

    // Fetch leads and next-follow-up map in parallel
    const [allLeads, nextFuMap] = await Promise.all([
      getAllLeads(sheetId),
      getNextFollowUpPerLead(sheetId),
    ]);

    // Attach nextFollowUp to every lead
    let leads = allLeads.map(l => ({
      ...l,
      nextFollowUp: nextFuMap.get(l.leadId) ?? null,
    }));

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
      budget, notes,
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
      budget: parseFloat(budget) || 0,
      notes: notes || '',
    });

    // Re-fetch to get proper rowIndex
    const allLeads = await getAllLeads(sheetId);
    const saved = allLeads.find(l => l.leadId === lead.leadId) || lead;

    res.status(201).json({ success: true, data: { ...saved, nextFollowUp: null } });
  } catch (error) {
    console.error('Error creating lead:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/leads/archived  ← must be declared BEFORE /:leadId
router.get('/archived', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const leads = await getAllArchivedLeads(sheetId);
    // Sort: most recently archived first
    leads.sort((a, b) => {
      const da = a.archivedAt ? new Date(a.archivedAt) : new Date(0);
      const db = b.archivedAt ? new Date(b.archivedAt) : new Date(0);
      return db - da;
    });
    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('Error fetching archived leads:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/leads/:leadId
router.get('/:leadId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const [lead, followUps] = await Promise.all([
      getLeadById(sheetId, req.params.leadId),
      getFollowUpsForLead(sheetId, req.params.leadId),
    ]);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: { ...lead, followUps } });
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

// ── Archive / Unarchive ────────────────────────────────────────

// PATCH /api/leads/:leadId/archive
router.patch('/:leadId/archive', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const result = await archiveLead(sheetId, req.params.leadId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error archiving lead:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// PATCH /api/leads/:leadId/unarchive
router.patch('/:leadId/unarchive', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const result = await unarchiveLead(sheetId, req.params.leadId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error unarchiving lead:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ── Follow-up sub-routes ───────────────────────────────────────

// POST /api/leads/:leadId/followups
router.post('/:leadId/followups', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { leadId } = req.params;
    const { scheduledDate } = req.body;

    // Validate scheduledDate
    if (!scheduledDate) {
      return res.status(400).json({ success: false, error: 'scheduledDate is required (DD/MM/YYYY)' });
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(scheduledDate)) {
      return res.status(400).json({ success: false, error: 'scheduledDate must be in DD/MM/YYYY format' });
    }

    // Ensure the lead exists and is not Converted or Lost
    const lead = await getLeadById(sheetId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    if (lead.leadStatus === 'Converted' || lead.leadStatus === 'Lost') {
      return res.status(400).json({ success: false, error: 'Cannot schedule a follow-up for a Converted or Lost lead' });
    }

    const followUp = await addFollowUp(sheetId, { leadId, scheduledDate });
    res.status(201).json({ success: true, data: followUp });
  } catch (error) {
    console.error('Error adding follow-up:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/leads/:leadId/followups/:followUpId
router.patch('/:leadId/followups/:followUpId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { leadId, followUpId } = req.params;
    const { remarks = '' } = req.body;

    // Verify the follow-up belongs to this lead
    const followUps = await getFollowUpsForLead(sheetId, leadId);
    const fu = followUps.find(f => f.followUpId === followUpId);
    if (!fu) {
      return res.status(404).json({ success: false, error: 'Follow-up not found for this lead' });
    }

    const updated = await markFollowUpHappened(sheetId, followUpId, remarks);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating follow-up:', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
