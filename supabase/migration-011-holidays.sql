-- Public holiday calendar — used to exclude non-billable days from
-- revenue calculations and to drive the dashboard's leave/holiday widgets.
-- Readable by all authenticated users; only admin + finance can write.

CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('IN', 'US', 'AE', 'GLOBAL')),
  name TEXT NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date_country ON holidays (holiday_date, country, name);
CREATE INDEX IF NOT EXISTS idx_holidays_country_year ON holidays (country, holiday_date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select_authenticated" ON holidays;
CREATE POLICY "holidays_select_authenticated"
  ON holidays FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "holidays_modify_admin_finance" ON holidays;
CREATE POLICY "holidays_modify_admin_finance"
  ON holidays FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

-- Seed: India + US 2026 holidays.
INSERT INTO holidays (holiday_date, country, name) VALUES
  -- India 2026
  ('2026-01-01', 'IN', 'New Year''s Day'),
  ('2026-01-26', 'IN', 'Republic Day'),
  ('2026-03-06', 'IN', 'Holi'),
  ('2026-03-21', 'IN', 'Eid al-Fitr'),
  ('2026-04-03', 'IN', 'Good Friday'),
  ('2026-04-14', 'IN', 'Ambedkar Jayanti'),
  ('2026-05-01', 'IN', 'Labour Day'),
  ('2026-05-27', 'IN', 'Eid al-Adha'),
  ('2026-08-15', 'IN', 'Independence Day'),
  ('2026-08-26', 'IN', 'Janmashtami'),
  ('2026-10-02', 'IN', 'Gandhi Jayanti'),
  ('2026-10-20', 'IN', 'Dussehra'),
  ('2026-11-08', 'IN', 'Diwali'),
  ('2026-11-25', 'IN', 'Guru Nanak Jayanti'),
  ('2026-12-25', 'IN', 'Christmas Day'),
  -- USA 2026
  ('2026-01-01', 'US', 'New Year''s Day'),
  ('2026-01-19', 'US', 'Martin Luther King Jr. Day'),
  ('2026-02-16', 'US', 'Presidents'' Day'),
  ('2026-05-25', 'US', 'Memorial Day'),
  ('2026-06-19', 'US', 'Juneteenth'),
  ('2026-07-03', 'US', 'Independence Day (observed)'),
  ('2026-09-07', 'US', 'Labor Day'),
  ('2026-10-12', 'US', 'Columbus Day'),
  ('2026-11-11', 'US', 'Veterans Day'),
  ('2026-11-26', 'US', 'Thanksgiving Day'),
  ('2026-11-27', 'US', 'Day after Thanksgiving'),
  ('2026-12-25', 'US', 'Christmas Day')
ON CONFLICT DO NOTHING;
