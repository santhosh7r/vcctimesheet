-- Add DocuSign signer tracking columns to SOWs
ALTER TABLE sows ADD COLUMN IF NOT EXISTS docusign_signer_name TEXT;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS docusign_signer_email TEXT;

-- Index for webhook lookups by envelope ID
CREATE INDEX IF NOT EXISTS idx_sows_docusign_envelope ON sows (docusign_envelope_id)
  WHERE docusign_envelope_id IS NOT NULL;
