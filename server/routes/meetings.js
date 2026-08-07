import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { project, month } = req.query;
  let sql = 'SELECT m.*, u.name as created_by_name FROM meetings m JOIN users u ON m.created_by = u.id WHERE 1=1';
  const params = [];
  if (project) { sql += ' AND m.project = ?'; params.push(project); }
  if (month) { sql += ' AND m.date LIKE ?'; params.push(`${month}%`); }
  sql += ' ORDER BY m.date DESC, m.time DESC';
  res.json({ meetings: db.prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const { title, date, time, attendees, notes, project, createdBy } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date required' });
  const result = db.prepare('INSERT INTO meetings (title, date, time, attendees, notes, project, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    title, date, time, attendees, notes, project, createdBy || req.user.id
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { title, date, time, attendees, notes, project } = req.body;
  const fields = [];
  const params = [];
  if (title !== undefined) { fields.push('title = ?'); params.push(title); }
  if (date !== undefined) { fields.push('date = ?'); params.push(date); }
  if (time !== undefined) { fields.push('time = ?'); params.push(time); }
  if (attendees !== undefined) { fields.push('attendees = ?'); params.push(attendees); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (project !== undefined) { fields.push('project = ?'); params.push(project); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/actions', (req, res) => {
  const actions = db.prepare('SELECT ma.*, u.name as assigned_to_name FROM meeting_actions ma LEFT JOIN users u ON ma.assigned_to = u.id WHERE ma.meeting_id = ? ORDER BY ma.created_at').all(req.params.id);
  res.json({ actions });
});

router.post('/:id/actions', (req, res) => {
  const { description, assignedTo, dueDate } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });
  const result = db.prepare('INSERT INTO meeting_actions (meeting_id, description, assigned_to, due_date) VALUES (?, ?, ?, ?)').run(
    req.params.id, description, assignedTo || null, dueDate || null
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/actions/:actionId', (req, res) => {
  const { status, description } = req.body;
  const fields = [];
  const params = [];
  if (status !== undefined) {
    fields.push('status = ?');
    params.push(status);
    if (status === 'completed') fields.push("completed_at = datetime('now')");
    else fields.push('completed_at = NULL');
  }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  params.push(req.params.actionId);
  db.prepare(`UPDATE meeting_actions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

export default router;
