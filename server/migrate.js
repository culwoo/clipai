const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = './data/clipai.db';
const db = new sqlite3.Database(dbPath);

console.log('Adding refresh_token column to users table...');

db.run(`ALTER TABLE users ADD COLUMN refresh_token TEXT`, (err) => {
  if (err && err.message.includes('duplicate column name')) {
    console.log('Column refresh_token already exists');
  } else if (err) {
    console.error('Error adding column:', err.message);
  } else {
    console.log('Column refresh_token added successfully');
  }
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database closed successfully');
    }
  });
});