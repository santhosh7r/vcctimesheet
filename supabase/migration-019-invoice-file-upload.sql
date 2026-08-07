-- Add file attachment support to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Create storage bucket for invoice documents (run in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;
