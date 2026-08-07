import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM requirements';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  res.json({ requirements: db.prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const { title, description, project, locationType, locationDetail, positionsCount, skills, priority, createdBy } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare('INSERT INTO requirements (title, description, project, location_type, location_detail, positions_count, skills, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    title, description, project, locationType, locationDetail, positionsCount || 1, skills, priority || 'medium', createdBy || req.user.id
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { title, description, project, locationType, locationDetail, positionsCount, skills, priority, status } = req.body;
  const fields = [];
  const params = [];
  if (title !== undefined) { fields.push('title = ?'); params.push(title); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (project !== undefined) { fields.push('project = ?'); params.push(project); }
  if (locationType !== undefined) { fields.push('location_type = ?'); params.push(locationType); }
  if (locationDetail !== undefined) { fields.push('location_detail = ?'); params.push(locationDetail); }
  if (positionsCount !== undefined) { fields.push('positions_count = ?'); params.push(positionsCount); }
  if (skills !== undefined) { fields.push('skills = ?'); params.push(skills); }
  if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE requirements SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM requirements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
