-- Employee salaries (CTC) — sensitive payroll data.
-- Visible only to admin (admin) and finance roles via RLS.

CREATE TABLE IF NOT EXISTS employee_salaries (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  department TEXT,
  location TEXT,                    -- 'India' | 'USA' | 'UAE' | etc.
  joined_date DATE,
  ctc_amount NUMERIC(14, 2),        -- best-effort parsed amount; may be NULL
  ctc_currency TEXT,                -- 'INR' | 'USD' | 'AED' | NULL
  ctc_period TEXT,                  -- 'annual' | 'hourly' | 'monthly' | 'unknown'
  ctc_raw TEXT,                     -- original spreadsheet text preserved verbatim
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_salaries_location ON employee_salaries (location);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_joined_date ON employee_salaries (joined_date);

-- RLS: only admin (admin) and finance can read/write.
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salaries_select_admin_finance" ON employee_salaries;
CREATE POLICY "salaries_select_admin_finance"
  ON employee_salaries FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "salaries_insert_admin_finance" ON employee_salaries;
CREATE POLICY "salaries_insert_admin_finance"
  ON employee_salaries FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "salaries_update_admin_finance" ON employee_salaries;
CREATE POLICY "salaries_update_admin_finance"
  ON employee_salaries FOR UPDATE
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "salaries_delete_admin" ON employee_salaries;
CREATE POLICY "salaries_delete_admin"
  ON employee_salaries FOR DELETE
  USING (get_user_role() = 'admin');
