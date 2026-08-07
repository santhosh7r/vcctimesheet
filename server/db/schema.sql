CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','admin')),
  designation TEXT,
  project TEXT,
  start_date TEXT,
  end_date TEXT,
  hourly_rate REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  period_label TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','saved','submitted')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, period_label)
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_id INTEGER NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  day_name TEXT,
  work_item TEXT,
  description TEXT,
  hours REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS frozen_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_label TEXT NOT NULL,
  project TEXT,
  frozen_at TEXT DEFAULT (datetime('now')),
  UNIQUE(period_label, project)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  doc_type TEXT NOT NULL CHECK(doc_type IN ('sow','offer_letter','contract','other')),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  project TEXT,
  location_type TEXT CHECK(location_type IN ('onsite','offshore','hybrid')),
  location_detail TEXT,
  positions_count INTEGER DEFAULT 1,
  skills TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','closed','on_hold')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  leave_type TEXT NOT NULL CHECK(leave_type IN ('casual','sick','earned','unpaid','wfh','comp_off')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days_count REAL NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_days REAL DEFAULT 0,
  used_days REAL DEFAULT 0,
  UNIQUE(user_id, leave_type, year)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked')),
  estimated_hours REAL,
  actual_hours REAL,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kpi_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  period TEXT NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_assigned INTEGER DEFAULT 0,
  avg_completion_time REAL,
  quality_score REAL,
  attendance_score REAL,
  overall_score REAL,
  evaluated_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, period)
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  attendees TEXT,
  notes TEXT,
  project TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meeting_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to TEXT REFERENCES users(id),
  due_date TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','cancelled')),
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client_name TEXT,
  deal_value REAL,
  currency TEXT DEFAULT 'USD',
  stage TEXT DEFAULT 'prospect' CHECK(stage IN ('prospect','qualified','proposal','negotiation','closed_won','closed_lost')),
  probability INTEGER DEFAULT 0,
  expected_close_date TEXT,
  owner_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES sales_deals(id) ON DELETE CASCADE,
  activity_type TEXT CHECK(activity_type IN ('call','email','meeting','note','task')),
  description TEXT,
  date TEXT DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ninebox_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  potential TEXT NOT NULL CHECK(potential IN ('low','medium','high')),
  performance TEXT NOT NULL CHECK(performance IN ('low','medium','high')),
  period TEXT NOT NULL,
  notes TEXT,
  placed_by TEXT NOT NULL REFERENCES users(id),
  placed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, period)
);
