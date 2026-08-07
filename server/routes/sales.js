import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { stage, ownerId } = req.query;
  let sql = 'SELECT * FROM sales_deals WHERE 1=1';
  const params = [];
  if (stage) { sql += ' AND stage = ?'; params.push(stage); }
  if (ownerId) { sql += ' AND owner_id = ?'; params.push(ownerId); }
  sql += ' ORDER BY created_at DESC';
  res.json({ deals: db.prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const { title, clientName, dealValue, currency, stage, probability, expectedCloseDate, ownerId, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare('INSERT INTO sales_deals (title, client_name, deal_value, currency, stage, probability, expected_close_date, owner_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    title, clientName, dealValue || 0, currency || 'USD', stage || 'prospect', probability || 0, expectedCloseDate, ownerId, notes
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { title, clientName, dealValue, currency, stage, probability, expectedCloseDate, notes } = req.body;
  const fields = [];
  const params = [];
  if (title !== undefined) { fields.push('title = ?'); params.push(title); }
  if (clientName !== undefined) { fields.push('client_name = ?'); params.push(clientName); }
  if (dealValue !== undefined) { fields.push('deal_value = ?'); params.push(dealValue); }
  if (currency !== undefined) { fields.push('currency = ?'); params.push(currency); }
  if (stage !== undefined) { fields.push('stage = ?'); params.push(stage); }
  if (probability !== undefined) { fields.push('probability = ?'); params.push(probability); }
  if (expectedCloseDate !== undefined) { fields.push('expected_close_date = ?'); params.push(expectedCloseDate); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE sales_deals SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sales_deals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/activities', (req, res) => {
  const activities = db.prepare('SELECT * FROM sales_activities WHERE deal_id = ? ORDER BY date DESC').all(req.params.id);
  res.json({ activities });
});

router.post('/:id/activities', (req, res) => {
  const { activityType, description, createdBy } = req.body;
  db.prepare('INSERT INTO sales_activities (deal_id, activity_type, description, created_by) VALUES (?, ?, ?, ?)').run(
    req.params.id, activityType, description, createdBy || req.user.id
  );
  res.status(201).json({ success: true });
});

export default router;
