-- ============================================================
-- Destructive-run guard. Must stay first in setup-all.sql.
--
-- migration-006-all-employees.sql performs a deliberate reset: it drops
-- every FK referencing users, then DELETEs users, timesheets,
-- timesheet_entries, leaves, leave_balances and ninebox_placements
-- before re-inserting the 69-person roster.
--
-- That is correct on a fresh database and catastrophic on a live one --
-- a second run silently discards every timesheet and leave request
-- entered since the first. So: refuse to run if the database already
-- holds activity, and say why.
--
-- To deliberately wipe and rebuild, drop the data first:
--   TRUNCATE timesheets CASCADE;
-- ...then re-run this script.
--
-- The checks are dynamic (EXECUTE) because on a genuinely fresh
-- database these tables do not exist yet and static SQL inside plpgsql
-- would fail to parse.
-- ============================================================

DO $$
DECLARE
  n BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['timesheets', 'leaves'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('SELECT count(*) FROM public.%I', tbl) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION
          'setup-all.sql refuses to run: public.% already has % row(s).'
          '  This script performs a destructive reset (migration-006 deletes'
          ' all users, timesheets, timesheet_entries, leaves, leave_balances'
          ' and ninebox_placements) and would discard that data.'
          '  It is meant to be run ONCE on a new project.'
          '  See SETUP.md.',
          tbl, n;
      END IF;
    END IF;
  END LOOP;
END $$;
