const express = require('express');
const cors = require('cors');
const env = require('./config/env');

const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const ordersRouter = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');
const insightsRouter = require('./routes/insights');
const customersRouter = require('./routes/customers');
const inventoryRouter = require('./routes/inventory');
const uploadRouter = require('./routes/upload');
const settingsRouter = require('./routes/settings');
const leadsRouter = require('./routes/leads');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(u => u.trim())
    : '*',
}));
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OMS API is running' });
});

// Auth middleware — all routes below require authentication
app.use('/api', authMiddleware);

app.use('/api/orders', ordersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/settings/categories', settingsRouter);
app.use('/api/leads', leadsRouter);

app.get('/api/debug/sheets', async (req, res) => {
  const { getSheetNames } = require('./services/sheets');
  const names = await getSheetNames(req.user.sheetId);
  res.json({ success: true, data: names });
});

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
