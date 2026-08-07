import { Router } from 'express';
import db from '../db/database.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const ALLOWED_ROLES = ['employee', 'manager', 'admin', 'finance', 'client'];
const adminOnly = requireRole('admin');

router.get('/', (req, res) => {
  const { role, project } = req.query;
  let sql = 'SELECT * FROM users WHERE is_active = 1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (project) { sql += ' AND project = ?'; params.push(project); }
  sql += ' ORDER BY name';
  res.json({ users: db.prepare(sql).all(...params) });
});

router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.post('/', adminOnly, (req, res) => {
  const { id, name, email, role = 'employee', designation, project, start_date, end_date, hourly_rate } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ALLOWED_ROLES.join(', ')}` });
  try {
    db.prepare('INSERT INTO users (id, name, email, role, designation, project, start_date, end_date, hourly_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, email, role, designation, project, start_date, end_date, hourly_rate || 0);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    // Seed leave balances
    const insertBal = db.prepare('INSERT OR IGNORE INTO leave_balances (user_id, leave_type, year, total_days, used_days) VALUES (?, ?, ?, ?, 0)');
    insertBal.run(id, 'casual', 2026, 12);
    insertBal.run(id, 'sick', 2026, 10);
    insertBal.run(id, 'earned', 2026, 15);
    res.status(201).json({ user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', adminOnly, (req, res) => {
  const { name, email, phone, role, designation, project, start_date, end_date, hourly_rate, is_active } = req.body;
  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${ALLOWED_ROLES.join(', ')}` });
  }
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (email !== undefined) { fields.push('email = ?'); params.push(email); }
  if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
  if (role !== undefined) { fields.push('role = ?'); params.push(role); }
  if (designation !== undefined) { fields.push('designation = ?'); params.push(designation); }
  if (project !== undefined) { fields.push('project = ?'); params.push(project); }
  if (start_date !== undefined) { fields.push('start_date = ?'); params.push(start_date); }
  if (end_date !== undefined) { fields.push('end_date = ?'); params.push(end_date); }
  if (hourly_rate !== undefined) { fields.push('hourly_rate = ?'); params.push(hourly_rate); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ user: db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
