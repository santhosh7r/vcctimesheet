// Assembles supabase/setup-all.sql — a single idempotent script that builds
// the whole database from nothing. Run: node supabase/_build/build-setup.mjs
//
// Ordering rules that matter:
//   - missing-tables.sql sits after migration-013 (email_queue references
//     sows) and before migration-022-referral-resume (which ALTERs referrals).
//   - storage-and-rls.sql runs last so its open policies are applied over
//     every table, including ones created by later migrations.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sup = join(here, '..');

const ORDER = [
  '_build/guard.sql',                     // aborts if the DB already holds activity
  'schema.sql',
  'migration-001.sql',
  'migration-002-rls-fix.sql',
  'migration-003-archived.sql',
  'migration-004-region.sql',
  'migration-005-employee-status.sql',
  'migration-006-all-employees.sql',
  'migration-007-meeting-notes.sql',
  'migration-008-finance-role.sql',
  'migration-009-employee-salaries.sql',
  'migration-010-finance-billing.sql',
  'migration-011-holidays.sql',
  'migration-012-client-role.sql',
  'migration-013-sows.sql',
  '_build/missing-tables.sql',            // needs requirements + sows; must precede 022
  'migration-014-seed-finance-client-users.sql',
  'migration-014-sow-changes-requested.sql',
  'migration-015-docusign-columns.sql',
  'migration-015-vendors.sql',
  'migration-016-roster-entries.sql',
  'migration-017-vendor-realignment.sql',
  'migration-018-password-auth-audit.sql',
  'migration-019-invoice-file-upload.sql',
  'migration-020-sow-file-upload.sql',
  'migration-021-consultant-role.sql',
  'migration-022-referral-resume.sql',
  'migration-022-remove-dummy-vendors.sql',
  'migration-023-seed-client-manager.sql',
  '_build/storage-and-rls.sql',
];

// schema.sql's CREATE POLICY statements have no DROP guard, so a second run
// of setup-all.sql would fail with "policy already exists". Emit a DROP ahead
// of each one. The table name is always on the same line as the policy name.
function idempotentPolicies(sql) {
  return sql.replace(
    /^(\s*)CREATE POLICY "([^"]+)" ON ([A-Za-z_][A-Za-z0-9_.]*)/gm,
    (line, indent, name, table) =>
      `${indent}DROP POLICY IF EXISTS "${name}" ON ${table};\n${line}`
  );
}

const parts = [
  `-- ============================================================`,
  `-- VCC Timesheet App — complete database setup`,
  `--`,
  `-- GENERATED FILE. Do not edit by hand.`,
  `-- Regenerate with: node supabase/_build/build-setup.mjs`,
  `--`,
  `-- Paste the whole thing into the Supabase SQL Editor and run ONCE,`,
  `-- on a NEW project. Then run supabase/seed-demo.sql for demo data.`,
  `--`,
  `-- NOT safe to re-run against a database in use. migration-006 is a`,
  `-- destructive reset: it deletes all users, timesheets, leaves and`,
  `-- 9-box placements before re-inserting the roster. A guard at the top`,
  `-- aborts the script if any timesheet or leave rows already exist, so`,
  `-- a stray re-run fails loudly instead of discarding data.`,
  `-- ============================================================`,
  ``,
];

for (const rel of ORDER) {
  const sql = idempotentPolicies(readFileSync(join(sup, rel), 'utf8').trimEnd());
  parts.push(
    ``,
    `-- ############################################################`,
    `-- # ${rel}`,
    `-- ############################################################`,
    ``,
    sql,
    ``
  );
}

const out = parts.join('\n') + '\n';
writeFileSync(join(sup, 'setup-all.sql'), out);
console.log(
  `setup-all.sql written — ${ORDER.length} files, ${out.split('\n').length} lines`
);
