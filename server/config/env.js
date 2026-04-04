require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
  USER_ACCESS_SHEET_ID: process.env.USER_ACCESS_SHEET_ID,
  JWT_SECRET: process.env.JWT_SECRET || 'oms-dev-secret-change-in-prod',
};
