-- ============================================================
-- Tables that predate the tracked migrations.
--
-- These three tables were created by hand in the original Supabase
-- project and were never captured in schema.sql or any migration.
-- The app queries all three, so a database built only from the
-- tracked files is missing them and those screens break:
--
--   referrals      -- src/lib/supabaseApi.js  (/referrals GET,POST,PUT)
--                     migration-022-referral-resume.sql ALTERs it
--   sow_resources  -- src/lib/supabaseApi.js  (/sow-resources CRUD)
--                     src/client/lib/supabaseApi.js (manager lookup)
--   email_queue    -- src/lib/supabaseApi.js  (SOW send-to-finance)
--
-- Column shapes are reconstructed from the application's read/write
-- sites and from scripts/import_sow.py.
-- ============================================================

-- ── REFERRALS ──
-- Employee referral submissions against an open requirement.
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  requirement_id BIGINT REFERENCES requirements(id) ON DELETE SET NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_phone TEXT,
  referred_by TEXT REFERENCES users(id),
  referred_by_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON referrals (referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_requirement ON referrals (requirement_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- ── SOW RESOURCES ──
-- Flat roster of resources covered by a signed SOW. Keyed by name (the
-- app fuzzy-matches users.name against sow_resources.name) rather than
-- by user_id, because it also covers people with no login.
CREATE TABLE IF NOT EXISTS sow_resources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  project TEXT,
  manager TEXT,
  location TEXT,
  rate NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  sow_number TEXT,
  sow_file TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_resources_name ON sow_resources (lower(name));
CREATE INDEX IF NOT EXISTS idx_sow_resources_status ON sow_resources (status);
CREATE INDEX IF NOT EXISTS idx_sow_resources_sow_number ON sow_resources (sow_number);

ALTER TABLE sow_resources ENABLE ROW LEVEL SECURITY;

-- ── EMAIL QUEUE ──
-- Outbound mail parked by the SOW submit-to-finance flow and drained by
-- the serverless mailer. The app already tolerates this table being
-- absent (it warns and continues), but the queue silently drops mail
-- when it is.
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGSERIAL PRIMARY KEY,
  sow_id INTEGER REFERENCES sows(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  cc_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue (status);
CREATE INDEX IF NOT EXISTS idx_email_queue_sow ON email_queue (sow_id);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
