import { Router } from 'express';
import db from '../db/database.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { employeeId, role } = req.body;
  if (!employeeId || !role) return res.status(400).json({ error: 'employeeId and role required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND role = ? AND is_active = 1').get(employeeId, role);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user);
  res.json({ token, user });
});

router.get('/me', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
