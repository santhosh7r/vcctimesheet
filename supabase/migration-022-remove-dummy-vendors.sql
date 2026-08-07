-- Remove the seeded demo vendors (Deloitte, Rysun) and consolidate everything
-- under the one real partner, D4 Insight. All delivery staff are @d4insight.com,
-- so D4 Insight is the actual vendor; Deloitte/Rysun were demo placeholders from
-- migration-017. Also normalises a stray 9-box period string so placements show.

-- 1. Re-point every reference away from the dummy vendors BEFORE deleting them
--    (users.vendor_id and billable_projects.vendor_id both FK to vendors.id).
UPDATE users SET vendor_id = 'D4I'
  WHERE vendor_id IN ('DLTT', 'RYSUN');

-- 2. Attribute all of the client's real delivery staff + projects to D4 Insight.
UPDATE users SET vendor_id = 'D4I'
  WHERE role IN ('employee', 'consultant', 'manager') AND vendor_id IS NULL;

UPDATE billable_projects SET vendor_id = 'D4I'
  WHERE client_id = 'CLT001';

-- 3. Drop free-form roster rows tied to the dummy vendors, then the vendors.
DELETE FROM roster_entries WHERE vendor_id IN ('DLTT', 'RYSUN');
DELETE FROM vendors WHERE id IN ('DLTT', 'RYSUN');

-- 4. Normalise the inconsistent 9-box period label so those placements appear
--    under the standard "Q<n> YYYY" filter used by both the admin and client grids.
--    First drop any stray-format row that would collide with an already-correct
--    row for the same resource (unique constraint on user_id + period), then
--    rename the remaining stray-format rows.
DELETE FROM ninebox_placements a
  USING ninebox_placements b
  WHERE a.period = '2026-Q2' AND b.period = 'Q2 2026' AND a.user_id = b.user_id;

UPDATE ninebox_placements SET period = 'Q2 2026' WHERE period = '2026-Q2';
