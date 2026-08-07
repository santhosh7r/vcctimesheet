import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { userId, date, status, assignedBy } = req.query;
  let sql = 'SELECT t.*, u.name as user_name, a.name as assigned_by_name FROM tasks t JOIN users u ON t.user_id = u.id JOIN users a ON t.assigned_by = a.id WHERE 1=1';
  const params = [];
  if (userId) { sql += ' AND t.user_id = ?'; params.push(userId); }
  if (date) { sql += ' AND t.date = ?'; params.push(date); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (assignedBy) { sql += ' AND t.assigned_by = ?'; params.push(assignedBy); }
  sql += ' ORDER BY t.date DESC, t.created_at DESC';
  res.json({ tasks: db.prepare(sql).all(...params) });
});

router.get('/kpi/:userId', (req, res) => {
  const { period } = req.query;
  const userId = req.params.userId;
  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [userId];
  if (period) {
    sql += ' AND date LIKE ?';
    params.push(`${period}%`);
  }
  const tasks = db.prepare(sql).all(...params);
  const completed = tasks.filter(t => t.status === 'completed');
  const avgHours = completed.length > 0 ? completed.reduce((s, t) => s + (t.actual_hours || t.estimated_hours || 0), 0) / completed.length : 0;

  res.json({
    tasks_assigned: tasks.length,
    tasks_completed: completed.length,
    avg_hours: avgHours,
    employees: [{
      user_id: userId,
      assigned: tasks.length,
      completed: completed.length,
    }],
  });
});

router.post('/', (req, res) => {
  const { userId, assignedBy, title, description, date, priority, estimatedHours } = req.body;
  if (!userId || !assignedBy || !title || !date) return res.status(400).json({ error: 'Missing required fields' });
  const result = db.prepare('INSERT INTO tasks (user_id, assigned_by, title, description, date, priority, estimated_hours) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    userId, assignedBy, title, description, date, priority || 'medium', estimatedHours
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { status, title, description, priority, actualHours, estimatedHours } = req.body;
  const fields = [];
  const params = [];
  if (status !== undefined) {
    fields.push('status = ?');
    params.push(status);
    if (status === 'completed') {
      fields.push("completed_at = datetime('now')");
    }
  }
  if (title !== undefined) { fields.push('title = ?'); params.push(title); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
  if (actualHours !== undefined) { fields.push('actual_hours = ?'); params.push(actualHours); }
  if (estimatedHours !== undefined) { fields.push('estimated_hours = ?'); params.push(estimatedHours); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
