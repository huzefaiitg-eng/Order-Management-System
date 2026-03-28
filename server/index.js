const express = require('express');
const cors = require('cors');
const env = require('./config/env');

const ordersRouter = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');
const insightsRouter = require('./routes/insights');
const customersRouter = require('./routes/customers');
const inventoryRouter = require('./routes/inventory');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
}));
app.use(express.json());

app.use('/api/orders', ordersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/inventory', inventoryRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OMS API is running' });
});

app.get('/api/debug/sheets', async (req, res) => {
  const { getSheetNames } = require('./services/sheets');
  const names = await getSheetNames();
  res.json({ success: true, data: names });
});

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
