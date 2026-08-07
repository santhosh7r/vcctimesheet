-- Add is_archived column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
