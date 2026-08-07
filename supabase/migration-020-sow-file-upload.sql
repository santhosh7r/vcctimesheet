-- Add uploaded-document support to SOWs (e.g. the signed/source SOW PDF).
-- The file is stored in the existing public 'documents' storage bucket
-- (created in migration-019) under the 'sows/' prefix; these columns hold
-- the public URL and original filename, mapped to the SOW row / sow_number.
ALTER TABLE sows ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS file_name TEXT;
