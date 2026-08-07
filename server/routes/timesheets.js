import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { userId, period } = req.query;
  if (!userId || !period) return res.status(400).json({ error: 'userId and period required' });
  const ts = db.prepare('SELECT * FROM timesheets WHERE user_id = ? AND period_label = ?').get(userId, period);
  if (!ts) return res.json({ timesheet: null });
  const entries = db.prepare('SELECT * FROM timesheet_entries WHERE timesheet_id = ? ORDER BY date').all(ts.id);
  res.json({ timesheet: { ...ts, entries } });
});

router.get('/user/:userId', (req, res) => {
  const timesheets = db.prepare('SELECT * FROM timesheets WHERE user_id = ? ORDER BY updated_at DESC').all(req.params.userId);
  for (const ts of timesheets) {
    ts.entries = db.prepare('SELECT * FROM timesheet_entries WHERE timesheet_id = ? ORDER BY date').all(ts.id);
  }
  res.json({ timesheets });
});

router.get('/all', (req, res) => {
  const { period } = req.query;
  let sql = 'SELECT t.*, u.name as user_name, u.project as user_project FROM timesheets t JOIN users u ON t.user_id = u.id WHERE u.is_active = 1';
  const params = [];
  if (period) { sql += ' AND t.period_label = ?'; params.push(period); }
  sql += ' ORDER BY u.name';
  const timesheets = db.prepare(sql).all(...params);
  for (const ts of timesheets) {
    ts.entries = db.prepare('SELECT * FROM timesheet_entries WHERE timesheet_id = ? ORDER BY date').all(ts.id);
  }
  res.json({ timesheets });
});

router.post('/', (req, res) => {
  const { userId, periodLabel, entries, status = 'saved' } = req.body;
  if (!userId || !periodLabel) return res.status(400).json({ error: 'userId and periodLabel required' });

  const upsert = db.transaction(() => {
    db.prepare(`INSERT INTO timesheets (user_id, period_label, status, updated_at) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, period_label) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`).run(userId, periodLabel, status);

    const ts = db.prepare('SELECT id FROM timesheets WHERE user_id = ? AND period_label = ?').get(userId, periodLabel);
    db.prepare('DELETE FROM timesheet_entries WHERE timesheet_id = ?').run(ts.id);

    const insert = db.prepare('INSERT INTO timesheet_entries (timesheet_id, date, day_name, work_item, description, hours) VALUES (?, ?, ?, ?, ?, ?)');
    for (const e of (entries || [])) {
      insert.run(ts.id, e.date, e.dayName || e.day_name, e.workItem || e.work_item, e.description, e.hours || 0);
    }
    return ts.id;
  });

  const id = upsert();
  res.json({ success: true, id });
});

router.put('/:id/submit', (req, res) => {
  db.prepare("UPDATE timesheets SET status = 'submitted', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
