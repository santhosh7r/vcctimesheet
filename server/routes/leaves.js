import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { userId, status, month, year } = req.query;
  let sql = 'SELECT l.*, u.name as user_name FROM leaves l JOIN users u ON l.user_id = u.id WHERE 1=1';
  const params = [];
  if (userId) { sql += ' AND l.user_id = ?'; params.push(userId); }
  if (status) { sql += ' AND l.status = ?'; params.push(status); }
  if (year && month) {
    sql += ' AND l.start_date LIKE ?';
    params.push(`${year}-${month.padStart(2, '0')}%`);
  }
  sql += ' ORDER BY l.created_at DESC';
  res.json({ leaves: db.prepare(sql).all(...params) });
});

router.get('/balances/:userId', (req, res) => {
  const balances = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? ORDER BY leave_type').all(req.params.userId);
  res.json({ balances });
});

router.post('/', (req, res) => {
  const { userId, leaveType, startDate, endDate, daysCount, reason } = req.body;
  if (!userId || !leaveType || !startDate || !endDate) return res.status(400).json({ error: 'Missing required fields' });
  const result = db.prepare('INSERT INTO leaves (user_id, leave_type, start_date, end_date, days_count, reason) VALUES (?, ?, ?, ?, ?, ?)').run(
    userId, leaveType, startDate, endDate, daysCount, reason
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { status, approvedBy } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });

  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
  if (!leave) return res.status(404).json({ error: 'Leave not found' });

  db.prepare("UPDATE leaves SET status = ?, approved_by = ?, approved_at = datetime('now') WHERE id = ?").run(status, approvedBy, req.params.id);

  // Update balance if approved
  if (status === 'approved') {
    const year = new Date(leave.start_date).getFullYear();
    db.prepare('UPDATE leave_balances SET used_days = used_days + ? WHERE user_id = ? AND leave_type = ? AND year = ?').run(
      leave.days_count, leave.user_id, leave.leave_type, year
    );
  }

  res.json({ success: true });
});

export default router;
