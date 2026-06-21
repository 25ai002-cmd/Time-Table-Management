import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

let db;

if (isProd) {
  console.log('Connecting to PostgreSQL database...');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  db = {
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
    get: async (text, params) => {
      const res = await pool.query(text, params);
      return res.rows[0] || null;
    },
    run: async (text, params) => {
      const res = await pool.query(text, params);
      return { changes: res.rowCount };
    }
  };
} else {
  console.log('Connecting to local SQLite database...');
  const dbPath = path.resolve(__dirname, '../timetable.sqlite');
  const sqliteDb = new sqlite3.Database(dbPath);
  
  db = {
    query: (text, params = []) => {
      const sqliteText = text.replace(/\$(\d+)/g, '?');
      return new Promise((resolve, reject) => {
        sqliteDb.all(sqliteText, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
    },
    exec: (text) => {
      return new Promise((resolve, reject) => {
        sqliteDb.exec(text, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    get: (text, params = []) => {
      const sqliteText = text.replace(/\$(\d+)/g, '?');
      return new Promise((resolve, reject) => {
        sqliteDb.get(sqliteText, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    },
    run: (text, params = []) => {
      const sqliteText = text.replace(/\$(\d+)/g, '?');
      return new Promise((resolve, reject) => {
        sqliteDb.run(sqliteText, params, function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes, lastID: this.lastID });
        });
      });
    }
  };
}

export async function initDatabase() {
  if (isProd) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS institutions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        setup_completed BOOLEAN DEFAULT FALSE,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS institutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        setup_completed BOOLEAN DEFAULT FALSE,
        data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  console.log('Database initialized successfully.');
}

export default db;
