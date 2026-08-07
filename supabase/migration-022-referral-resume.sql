-- Add resume attachment columns to referrals.
-- The file is stored in the private 'documents' storage bucket under
-- referrals/<referral_id>/..., resume_file holds the object path and
-- resume_filename the original filename. Viewed via short-lived signed URLs.
-- (The referrals table predates the tracked migrations, hence ALTER here.)
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS resume_file TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS resume_filename TEXT;
