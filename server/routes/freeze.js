import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { period, project } = req.query;
  if (!period) return res.json({ frozen: false });
  const row = db.prepare('SELECT * FROM frozen_periods WHERE period_label = ? AND (project = ? OR project IS NULL)').get(period, project || null);
  res.json({ frozen: !!row, frozenPeriod: row || null });
});

router.get('/all', (req, res) => {
  const periods = db.prepare('SELECT * FROM frozen_periods ORDER BY frozen_at DESC').all();
  res.json({ frozenPeriods: periods });
});

router.post('/', (req, res) => {
  const { periodLabel, project } = req.body;
  if (!periodLabel) return res.status(400).json({ error: 'periodLabel required' });
  try {
    db.prepare('INSERT OR IGNORE INTO frozen_periods (period_label, project) VALUES (?, ?)').run(periodLabel, project || null);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
