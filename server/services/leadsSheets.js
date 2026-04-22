const { getClient, getCustomerByPhone, addCustomer } = require('./sheets');

// ── Column indices for Leads tab ────────────────────────────────
// A  B          C              D               E               F                     G            H            I               J       K      L                    M
// ID Date       CustomerName   CustomerPhone   CustomerEmail   ProductsInterested    LeadStatus   LeadSource   FollowUpDate    Budget  Notes  ConvertedOrderRow    CreatedAt

const COL = {
  leadId: 0,
  leadDate: 1,
  customerName: 2,
  customerPhone: 3,
  customerEmail: 4,
  productsInterested: 5,
  leadStatus: 6,
  leadSource: 7,
  followUpDate: 8,
  budget: 9,
  notes: 10,
  convertedOrderRow: 11,
  createdAt: 12,
};

function rowToLead(row, rowIndex) {
  return {
    leadId: row[COL.leadId] || '',
    leadDate: row[COL.leadDate] || '',
    customerName: row[COL.customerName] || '',
    customerPhone: row[COL.customerPhone] || '',
    customerEmail: row[COL.customerEmail] || '',
    productsInterested: row[COL.productsInterested] || '',
    leadStatus: row[COL.leadStatus] || 'New Lead',
    leadSource: row[COL.leadSource] || '',
    followUpDate: row[COL.followUpDate] || '',
    budget: parseFloat(row[COL.budget]) || 0,
    notes: row[COL.notes] || '',
    convertedOrderRow: row[COL.convertedOrderRow] || '',
    createdAt: row[COL.createdAt] || '',
    rowIndex,
  };
}

function formatDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ── Ensure Leads tab exists ───────────────────────────────────

async function ensureLeadsTab(sheetId) {
  const { getSheetNames } = require('./sheets');
  const names = await getSheetNames(sheetId);
  if (names.includes('Leads')) return;

  const sheets = await getClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'Leads' } } }],
      },
    });
  } catch (err) {
    if (err.message && err.message.includes('already exists')) return;
    throw err;
  }

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Leads!A1:M1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Lead ID', 'Lead Date', 'Customer Name', 'Customer Phone', 'Customer Email',
        'Products Interested', 'Lead Status', 'Lead Source', 'Follow-up Date',
        'Budget', 'Notes', 'Converted Order Row', 'Created At']],
    },
  });
}

// ── Read ──────────────────────────────────────────────────────

async function getAllLeads(sheetId) {
  await ensureLeadsTab(sheetId);
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Leads!A2:M',
  });
  const rows = response.data.values || [];
  return rows
    .map((row, i) => rowToLead(row, i + 2))
    .filter(lead => lead.leadId); // skip blank rows
}

async function getLeadById(sheetId, leadId) {
  const leads = await getAllLeads(sheetId);
  return leads.find(l => l.leadId === leadId) || null;
}

// ── Create ────────────────────────────────────────────────────

async function getNextLeadId(sheetId) {
  const leads = await getAllLeads(sheetId);
  const maxNum = leads.reduce((max, l) => {
    const num = parseInt(l.leadId.replace('LEAD-', '')) || 0;
    return Math.max(max, num);
  }, 0);
  return `LEAD-${String(maxNum + 1).padStart(3, '0')}`;
}

async function addLead(sheetId, {
  customerName, customerPhone, customerEmail = '',
  productsInterested = '', leadStatus = 'New Lead', leadSource = '',
  followUpDate = '', budget = 0, notes = '',
}) {
  await ensureLeadsTab(sheetId);

  const leadId = await getNextLeadId(sheetId);
  const leadDate = formatDate();
  const createdAt = new Date().toISOString();

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Leads!A:M',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        leadId, leadDate, customerName, customerPhone, customerEmail,
        productsInterested, leadStatus, leadSource, followUpDate,
        String(budget || 0), notes, '', createdAt,
      ]],
    },
  });

  // Auto-create or link customer record
  try {
    const existing = await getCustomerByPhone(sheetId, customerPhone);
    if (!existing) {
      await addCustomer(sheetId, {
        customerName,
        customerPhone,
        customerAddress: '',
        customerEmail: customerEmail || '',
      });
    }
  } catch (err) {
    // Non-fatal — customer might already exist with same phone (race) or have some other error
    console.warn('Lead creation: customer auto-create skipped:', err.message);
  }

  return rowToLead([
    leadId, leadDate, customerName, customerPhone, customerEmail,
    productsInterested, leadStatus, leadSource, followUpDate,
    String(budget || 0), notes, '', createdAt,
  ], -1); // rowIndex unknown at append time, refresh to get it
}

// ── Update ────────────────────────────────────────────────────

async function updateLead(sheetId, leadId, updates) {
  const leads = await getAllLeads(sheetId);
  const lead = leads.find(l => l.leadId === leadId);
  if (!lead) throw new Error('Lead not found');

  const sheets = await getClient();
  const rowIdx = lead.rowIndex;
  const data = [];

  const fieldColMap = {
    customerName: { col: 'C', key: 'customerName' },
    customerPhone: { col: 'D', key: 'customerPhone' },
    customerEmail: { col: 'E', key: 'customerEmail' },
    productsInterested: { col: 'F', key: 'productsInterested' },
    leadStatus: { col: 'G', key: 'leadStatus' },
    leadSource: { col: 'H', key: 'leadSource' },
    followUpDate: { col: 'I', key: 'followUpDate' },
    budget: { col: 'J', key: 'budget' },
    notes: { col: 'K', key: 'notes' },
    convertedOrderRow: { col: 'L', key: 'convertedOrderRow' },
  };

  for (const [field, { col }] of Object.entries(fieldColMap)) {
    if (updates[field] !== undefined) {
      data.push({
        range: `Leads!${col}${rowIdx}`,
        values: [[String(updates[field] === null ? '' : updates[field])]],
      });
    }
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  return { ...lead, ...updates };
}

// ── Delete ────────────────────────────────────────────────────

async function deleteLead(sheetId, leadId) {
  const leads = await getAllLeads(sheetId);
  const lead = leads.find(l => l.leadId === leadId);
  if (!lead) throw new Error('Lead not found');

  const { getSheetNames } = require('./sheets');
  const sheetNames = await getSheetNames(sheetId);
  if (!sheetNames.includes('Leads')) throw new Error('Leads sheet not found');

  const sheets = await getClient();
  // Get the numeric sheetId of the Leads tab
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });
  const leadsTab = spreadsheet.data.sheets.find(s => s.properties.title === 'Leads');
  if (!leadsTab) throw new Error('Leads tab not found');
  const leadsTabId = leadsTab.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: leadsTabId,
            dimension: 'ROWS',
            startIndex: lead.rowIndex - 1,
            endIndex: lead.rowIndex,
          },
        },
      }],
    },
  });

  return { deleted: true, leadId };
}

module.exports = {
  getAllLeads,
  getLeadById,
  addLead,
  updateLead,
  deleteLead,
};
