import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/clipai.db';

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath);

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          credits INTEGER DEFAULT 5,
          is_subscribed BOOLEAN DEFAULT 0,
          subscription_expires_at DATETIME,
          refresh_token TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Videos table
      db.run(`
        CREATE TABLE IF NOT EXISTS videos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          original_filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          duration REAL,
          width INTEGER,
          height INTEGER,
          status TEXT DEFAULT 'uploaded',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Processing results table
      db.run(`
        CREATE TABLE IF NOT EXISTS processing_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id INTEGER NOT NULL,
          user_id INTEGER,
          status TEXT DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Highlight clips table
      db.run(`
        CREATE TABLE IF NOT EXISTS highlight_clips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          processing_result_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          thumbnail_path TEXT,
          duration REAL NOT NULL,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          confidence_score REAL DEFAULT 0.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (processing_result_id) REFERENCES processing_results (id) ON DELETE CASCADE
        )
      `);

      // Thumbnails table
      db.run(`
        CREATE TABLE IF NOT EXISTS thumbnails (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          processing_result_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          timestamp REAL NOT NULL,
          width INTEGER,
          height INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (processing_result_id) REFERENCES processing_results (id) ON DELETE CASCADE
        )
      `);

      // Captions table
      db.run(`
        CREATE TABLE IF NOT EXISTS captions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          processing_result_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          content TEXT NOT NULL,
          hashtags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (processing_result_id) REFERENCES processing_results (id) ON DELETE CASCADE
        )
      `);

      // URL downloads table (for YouTube/TikTok)
      db.run(`
        CREATE TABLE IF NOT EXISTS url_downloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          original_url TEXT NOT NULL,
          platform TEXT NOT NULL,
          video_id INTEGER,
          title TEXT,
          description TEXT,
          duration REAL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
        )
      `);

      // Add stripe_customer_id to users table if not exists
      db.run(`
        ALTER TABLE users ADD COLUMN stripe_customer_id TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding stripe_customer_id column:', err);
        }
      });

      // Payments table
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          currency TEXT DEFAULT 'krw',
          credits INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          stripe_payment_intent_id TEXT,
          package_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Subscriptions table
      db.run(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          plan_id TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          stripe_subscription_id TEXT,
          monthly_credits INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Indexes for better performance
      db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      db.run('CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_processing_results_video_id ON processing_results(video_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_processing_results_user_id ON processing_results(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_highlight_clips_processing_result_id ON highlight_clips(processing_result_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_thumbnails_processing_result_id ON thumbnails(processing_result_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_captions_processing_result_id ON captions(processing_result_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_url_downloads_user_id ON url_downloads(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)');

      console.log('Database tables created successfully');
      resolve();
    });

    db.on('error', (err) => {
      console.error('Database error:', err);
      reject(err);
    });
  });
};