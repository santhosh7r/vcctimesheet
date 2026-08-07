import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/timesheet-summary', (req, res) => {
  const { period, project } = req.query;
  let sql = `SELECT u.project, COUNT(DISTINCT u.id) as employee_count,
    COUNT(DISTINCT CASE WHEN t.status = 'submitted' THEN t.user_id END) as submitted_count,
    COALESCE(SUM(te.hours), 0) as total_hours
    FROM users u
    LEFT JOIN timesheets t ON u.id = t.user_id ${period ? "AND t.period_label = ?" : ""}
    LEFT JOIN timesheet_entries te ON t.id = te.timesheet_id
    WHERE u.is_active = 1 AND u.role = 'employee'`;
  const params = [];
  if (period) params.push(period);
  if (project) { sql += ' AND u.project = ?'; params.push(project); }
  sql += ' GROUP BY u.project';
  res.json({ summary: db.prepare(sql).all(...params) });
});

router.get('/leave-summary', (req, res) => {
  const { year } = req.query;
  const byType = db.prepare(`SELECT leave_type, SUM(days_count) as total_days, COUNT(*) as count
    FROM leaves WHERE status = 'approved' ${year ? "AND start_date LIKE ?" : ""} GROUP BY leave_type`).all(...(year ? [`${year}%`] : []));
  const byEmployee = db.prepare(`SELECT l.user_id, u.name as user_name, SUM(l.days_count) as total_days
    FROM leaves l JOIN users u ON l.user_id = u.id WHERE l.status = 'approved' ${year ? "AND l.start_date LIKE ?" : ""}
    GROUP BY l.user_id ORDER BY total_days DESC`).all(...(year ? [`${year}%`] : []));
  res.json({ by_type: byType, by_employee: byEmployee });
});

router.get('/task-summary', (req, res) => {
  const { period } = req.query;
  let where = '';
  const params = [];
  if (period) { where = ' AND t.date LIKE ?'; params.push(`${period}%`); }
  const employees = db.prepare(`SELECT t.user_id, u.name as user_name,
    COUNT(*) as assigned,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked
    FROM tasks t JOIN users u ON t.user_id = u.id WHERE 1=1 ${where}
    GROUP BY t.user_id ORDER BY completed DESC`).all(...params);
  res.json({ employees });
});

router.get('/sales-pipeline', (req, res) => {
  const stages = db.prepare('SELECT stage, COUNT(*) as count, COALESCE(SUM(deal_value), 0) as total_value FROM sales_deals GROUP BY stage ORDER BY CASE stage WHEN \'prospect\' THEN 1 WHEN \'qualified\' THEN 2 WHEN \'proposal\' THEN 3 WHEN \'negotiation\' THEN 4 WHEN \'closed_won\' THEN 5 WHEN \'closed_lost\' THEN 6 END').all();
  res.json({ stages });
});

export default router;
