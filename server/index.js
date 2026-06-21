import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { initDatabase } from './database.js';
import { authenticateToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'timetable-secret-key-change-in-prod';

app.use(cors());
app.use(express.json());

// Initialize DB
await initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// ─── AUTH ENDPOINTS ──────────────────────────────────────────────────────────

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    const existingUser = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    await db.run(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      [email.toLowerCase().trim(), passwordHash]
    );
    
    const newUser = await db.get('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: { id: newUser.id, email: newUser.email }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error during signup' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    const user = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(400).json({ message: 'Incorrect email or password' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect email or password' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

// Google Login
app.post('/api/auth/google-login', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ message: 'Access token is required' });
  }
  
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    if (!response.ok) {
      return res.status(400).json({ message: 'Failed to authenticate with Google' });
    }
    
    const googleUser = await response.json();
    const email = googleUser.email;
    if (!email) {
      return res.status(400).json({ message: 'Google account does not provide an email address' });
    }
    
    let user = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (!user) {
      const dummyPassword = Math.random().toString(36) + Math.random().toString(36);
      const passwordHash = await bcrypt.hash(dummyPassword, 10);
      await db.run(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
        [email.toLowerCase().trim(), passwordHash]
      );
      user = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ message: 'Internal server error during Google login' });
  }
});

// Verify user token
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

// ─── INSTITUTION ENDPOINTS ───────────────────────────────────────────────────

// Load institution data
app.get('/api/institution', authenticateToken, async (req, res) => {
  try {
    const row = await db.get('SELECT data, setup_completed FROM institutions WHERE user_id = $1', [req.user.id]);
    if (!row) {
      return res.status(404).json({ message: 'Institution data not found' });
    }
    
    let institutionData;
    if (typeof row.data === 'string') {
      institutionData = JSON.parse(row.data);
    } else {
      institutionData = row.data;
    }
    
    res.json(institutionData);
  } catch (err) {
    console.error('Fetch institution error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Save or update institution data
app.post('/api/institution', authenticateToken, async (req, res) => {
  const data = req.body;
  const setupCompleted = data.setupCompleted || data.setupComplete || false;
  
  try {
    const existing = await db.get('SELECT id FROM institutions WHERE user_id = $1', [req.user.id]);
    const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
    const dbData = isProd ? data : JSON.stringify(data);
    
    if (existing) {
      await db.run(
        'UPDATE institutions SET data = $1, setup_completed = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3',
        [dbData, setupCompleted, req.user.id]
      );
    } else {
      await db.run(
        'INSERT INTO institutions (user_id, data, setup_completed) VALUES ($1, $2, $3)',
        [req.user.id, dbData, setupCompleted]
      );
    }
    
    res.json({ message: 'Institution data saved successfully' });
  } catch (err) {
    console.error('Save institution error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve frontend static files in production
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all route to serve frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
