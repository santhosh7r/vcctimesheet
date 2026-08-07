-- Add 'changes_requested' to the sows status check constraint
ALTER TABLE sows DROP CONSTRAINT IF EXISTS sows_status_check;
ALTER TABLE sows ADD CONSTRAINT sows_status_check
  CHECK (status IN ('draft', 'submitted_for_finance', 'changes_requested', 'finance_approved', 'sent_for_signature', 'signed', 'active', 'rejected', 'cancelled'));
