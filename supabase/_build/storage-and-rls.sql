-- ============================================================
-- Storage bucket + anon-key access policies
-- ============================================================

-- ── STORAGE ──
-- One private 'documents' bucket. src/lib/api.js getFileUrl() mints a
-- short-lived signed URL for anything stored here, so the bucket must
-- NOT be public. Invoice attachments (migration 019), SOW attachments
-- (migration 020) and referral resumes (migration 022) all live here.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_read" ON storage.objects;
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_write" ON storage.objects;
CREATE POLICY "documents_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_update" ON storage.objects;
CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents');


-- ============================================================
-- ── ROW LEVEL SECURITY: open access for the anon key ──
--
-- READ THIS BEFORE RUNNING.
--
-- This app does not use Supabase Auth. It authenticates users itself
-- (src/lib/supabaseApi.js '/auth/login') and enforces role rules in
-- application code. But the RLS policies written in schema.sql and in
-- migrations 010-016 gate every row on get_user_role(), which reads
-- auth.uid() -- always NULL here. Under the anon key those policies
-- therefore match nothing and every finance, SOW, vendor and roster
-- screen comes back empty.
--
-- There are exactly two ways to make the app show data:
--
--   A) Ship the SERVICE ROLE key to the browser (VITE_SUPABASE_SERVICE_KEY).
--      This is what the code does today. It bypasses RLS entirely and
--      also hands every visitor full admin rights over the project,
--      including Storage and the ability to read and rewrite any table.
--      Anyone who opens devtools has it.
--
--   B) Run the block below and ship only the ANON key.
--      Access is still wide open at the database level -- the anon key
--      can read and write every table -- but it cannot touch project
--      administration, and it can be rotated without redeploying keys
--      that grant more than data access.
--
-- Neither option is safe for real customer data. (B) is the lesser of
-- the two and is what SETUP.md recommends for the demo. Replacing these
-- policies with real per-role rules is the follow-up work needed before
-- this database holds anything that is not demo data.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo_open_access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "demo_open_access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;
