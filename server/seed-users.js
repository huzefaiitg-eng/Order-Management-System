require('dotenv').config();
const { google } = require('googleapis');
const env = require('./config/env');

async function seedUsers() {
  const credentials = JSON.parse(
    process.env.GOOGLE_CREDENTIALS || require('fs').readFileSync(env.GOOGLE_CREDENTIALS_PATH, 'utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = env.USER_ACCESS_SHEET_ID;

  // Write headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Sheet1!A1:H1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Name', 'Company Name', 'Email', 'Phone', 'Address', 'Website', 'Password', 'Order Sheet Link']],
    },
  });

  // Write demo user
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Sheet1!A2:H2',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Hozefa kanchwala',
        'Bombay Strides',
        'demo@kanchwalahozefa.com',
        '9989972430',
        '1308 One Wagle, Wagle Estate, Thane, Maharashtra 400607',
        'www.kanchwalahozefa.com',
        'demo@12345',
        'https://docs.google.com/spreadsheets/d/1p5IE2zLh0Z5uZjFlSGDiqUoGLcdxuolrt7w-Av_YcgE/edit?usp=sharing',
      ]],
    },
  });

  console.log('Demo user seeded successfully!');
  console.log('Email: demo@kanchwalahozefa.com');
  console.log('Password: demo@12345');
}

seedUsers().catch(err => {
  console.error('Failed to seed users:', err.message);
  process.exit(1);
});
