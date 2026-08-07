import { Router } from 'express';
import db from '../db/database.js';
import { upload } from '../middleware/upload.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

router.get('/', (req, res) => {
  const { userId } = req.query;
  let sql = 'SELECT * FROM documents';
  const params = [];
  if (userId) { sql += ' WHERE user_id = ?'; params.push(userId); }
  sql += ' ORDER BY uploaded_at DESC';
  res.json({ documents: db.prepare(sql).all(...params) });
});

router.post('/', upload.single('file'), (req, res) => {
  const { userId, docType, uploadedBy } = req.body;
  if (!req.file || !userId || !docType) return res.status(400).json({ error: 'file, userId, docType required' });

  db.prepare('INSERT INTO documents (user_id, doc_type, original_name, stored_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    userId, docType, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, uploadedBy || req.user.id
  );
  res.status(201).json({ success: true });
});

router.get('/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(__dirname, '..', 'uploads', doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

router.delete('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (doc) {
    const filePath = path.join(__dirname, '..', 'uploads', doc.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

export default router;
