import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import seed from './db/seed.js';
import db from './db/database.js';
import { authenticateToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import timesheetRoutes from './routes/timesheets.js';
import freezeRoutes from './routes/freeze.js';
import documentRoutes from './routes/documents.js';
import requirementRoutes from './routes/requirements.js';
import leaveRoutes from './routes/leaves.js';
import taskRoutes from './routes/tasks.js';
import meetingRoutes from './routes/meetings.js';
import salesRoutes from './routes/sales.js';
import nineboxRoutes from './routes/ninebox.js';
import reportRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// Seed database on startup
seed();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes (public)
app.use('/api/auth', (req, res, next) => {
  // /api/auth/me requires auth, /api/auth/login does not
  if (req.path === '/me') return authenticateToken(req, res, next);
  next();
}, authRoutes);

// Public user listing for login page (limited fields)
app.get('/api/users-public', (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT id, name, role, project, designation FROM users WHERE is_active = 1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  sql += ' ORDER BY name';
  res.json({ users: db.prepare(sql).all(...params) });
});

// Protected routes
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/timesheets', authenticateToken, timesheetRoutes);
app.use('/api/freeze', authenticateToken, freezeRoutes);
app.use('/api/documents', authenticateToken, documentRoutes);
app.use('/api/requirements', authenticateToken, requirementRoutes);
app.use('/api/leaves', authenticateToken, leaveRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/meetings', authenticateToken, meetingRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/ninebox', authenticateToken, nineboxRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
