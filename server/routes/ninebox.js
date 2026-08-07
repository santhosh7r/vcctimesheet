import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { period } = req.query;
  let sql = 'SELECT n.*, u.name as user_name, u.hourly_rate, u.project FROM ninebox_placements n JOIN users u ON n.user_id = u.id WHERE 1=1';
  const params = [];
  if (period) { sql += ' AND n.period = ?'; params.push(period); }
  sql += ' ORDER BY u.name';
  res.json({ placements: db.prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const { userId, potential, performance, period, notes, placedBy } = req.body;
  if (!userId || !potential || !performance || !period) return res.status(400).json({ error: 'Missing required fields' });
  db.prepare(`INSERT INTO ninebox_placements (user_id, potential, performance, period, notes, placed_by) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, period) DO UPDATE SET potential = excluded.potential, performance = excluded.performance, notes = excluded.notes, placed_by = excluded.placed_by, placed_at = datetime('now')`).run(
    userId, potential, performance, period, notes, placedBy || req.user.id
  );
  res.status(201).json({ success: true });
});

router.put('/:id', (req, res) => {
  const { potential, performance, notes } = req.body;
  const fields = [];
  const params = [];
  if (potential) { fields.push('potential = ?'); params.push(potential); }
  if (performance) { fields.push('performance = ?'); params.push(performance); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  params.push(req.params.id);
  db.prepare(`UPDATE ninebox_placements SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ninebox_placements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
