// Generates supabase/seed-demo.sql from the app's own demo fixtures, so the
// live database shows exactly what mock mode shows.
// Run: node supabase/_build/build-seed.mjs
//
// Sources:
//   src/lib/demoData.js        — users, timesheets, tasks, SOWs, invoices, ...
//   src/data/employeeSalaries  — salary bands for the finance screens
//   scripts/import_sow.py      — the SOW resource roster, via
//                                extract-sow-resources.py -> sow-resources.json

import { createHash, pbkdf2Sync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const d = await import(join(root, 'src/lib/demoData.js'));
const sowResources = JSON.parse(readFileSync(join(here, 'sow-resources.json'), 'utf8'));

// ── SQL literal helpers ──
const q = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
// is_active arrives as 1/0 from the fixtures but the column is BOOLEAN.
const bool = (v) => (v === null || v === undefined ? 'NULL' : v ? 'true' : 'false');

const out = [];
const say = (...lines) => out.push(...lines);

/**
 * Emit an INSERT for `rows`, one VALUES tuple per row.
 * `cols` maps column name -> (row) => SQL literal.
 * `conflict` is the ON CONFLICT clause; DO NOTHING keeps migration-seeded
 * rows authoritative wherever the two overlap.
 */
function insert(table, cols, rows, conflict = '(id) DO NOTHING') {
  if (!rows.length) return;
  const names = Object.keys(cols);
  say(
    ``,
    `-- ${table} (${rows.length})`,
    `INSERT INTO ${table} (${names.join(', ')}) VALUES`
  );
  const tuples = rows.map(
    (r, i) => `  (${names.map((n) => cols[n](r, i)).join(', ')})`
  );
  say(tuples.join(',\n') + `\nON CONFLICT ${conflict};`);
}

/** Re-point a BIGSERIAL/SERIAL sequence past the explicit ids we just inserted. */
function resetSeq(table, col = 'id') {
  say(
    `SELECT setval(pg_get_serial_sequence('${table}', '${col}'),` +
      ` GREATEST((SELECT COALESCE(MAX(${col}), 0) FROM ${table}), 1));`
  );
}

say(
  `-- ============================================================`,
  `-- VCC Timesheet App — demo data`,
  `--`,
  `-- GENERATED FILE. Do not edit by hand.`,
  `-- Regenerate with: node supabase/_build/build-seed.mjs`,
  `--`,
  `-- Run AFTER setup-all.sql. Safe to re-run: every insert is`,
  `-- ON CONFLICT DO NOTHING and sequences are reset at the end of`,
  `-- each section.`,
  `-- ============================================================`,
  ``,
  `BEGIN;`
);

// ── USERS ──
// password_hash is deliberately left NULL: /auth/login only demands a password
// when the row has a hash, so every demo account signs in with its Employee ID
// alone. Set passwords from the admin UI before this holds anything real.
say(``, `-- ── People ──`);
insert(
  'users',
  {
    id: (r) => q(r.id),
    name: (r) => q(r.name),
    role: (r) => q(r.role),
    designation: (r) => q(r.designation),
    project: (r) => q(r.project),
    start_date: (r) => q(r.start_date),
    end_date: (r) => q(r.end_date),
    hourly_rate: (r) => q(r.hourly_rate ?? 0),
    is_active: (r) => bool(r.is_active),
    email: (r) => q(r.email),
    phone: (r) => q(r.phone),
  },
  d.users
);

// CLI001 is referenced by sows.finance_approved_by but no migration creates it
// (migration-014 seeds FIN001 and drops its client users; migration-023 adds
// only CLI002). Without this row the SOW inserts below fail their FK and the
// client portal has no finance login.
say(
  ``,
  `-- Client-side logins for the Client Portal (vendor tool).`,
  `-- CLI001 = client finance, CLI002 = client manager (seeded in migration-023).`,
  `INSERT INTO users (id, name, role, client_id, client_subrole, is_active, email, start_date) VALUES`,
  `  ('CLI001', 'Client Finance', 'client', 'CLT001', 'finance', true, 'finance@visualcomfort.com', '2024-01-01')`,
  `ON CONFLICT (id) DO UPDATE`,
  `  SET role = 'client', client_id = 'CLT001', client_subrole = 'finance', is_active = true;`
);

// ── CLIENTS / PROJECTS ──
say(``, `-- ── Billing reference data ──`);
insert(
  'clients',
  {
    id: (r) => q(r.id),
    name: (r) => q(r.name),
    region: (r) => q(r.region),
    contact_name: (r) => q(r.contact_name),
    contact_email: (r) => q(r.contact_email),
    status: (r) => q(r.status),
    notes: (r) => q(r.notes),
    created_at: (r) => q(r.created_at),
  },
  d.clients
);

insert(
  'billable_projects',
  {
    id: (r) => q(r.id),
    name: (r) => q(r.name),
    client_id: (r) => q(r.client_id),
    billing_type: (r) => q(r.billing_type),
    bill_rate: (r) => q(r.bill_rate),
    currency: (r) => q(r.currency),
    status: (r) => q(r.status),
    notes: (r) => q(r.notes),
    created_at: (r) => q(r.created_at),
  },
  d.billableProjects
);

// ── SOWS ──
say(``, `-- ── SOW workflow (one row at each lifecycle stage) ──`);
insert(
  'sows',
  {
    id: (r) => q(r.id),
    sow_number: (r) => q(r.sow_number),
    client_id: (r) => q(r.client_id),
    project_id: (r) => q(r.project_id),
    title: (r) => q(r.title),
    sow_type: (r) => q(r.sow_type),
    description: (r) => q(r.description),
    contract_value: (r) => q(r.contract_value),
    currency: (r) => q(r.currency),
    start_date: (r) => q(r.start_date),
    end_date: (r) => q(r.end_date),
    status: (r) => q(r.status),
    resource_name: (r) => q(r.resource_name),
    resource_role: (r) => q(r.resource_role),
    resource_rate: (r) => q(r.resource_rate),
    finance_approved_by: (r) => q(r.finance_approved_by),
    finance_approved_at: (r) => q(r.finance_approved_at),
    finance_notes: (r) => q(r.finance_notes),
    manager_signed_by: (r) => q(r.manager_signed_by),
    manager_signed_at: (r) => q(r.manager_signed_at),
    docusign_envelope_id: (r) => q(r.docusign_envelope_id),
    docusign_status: (r) => q(r.docusign_status),
    created_by: (r) => q(r.created_by),
    created_at: (r) => q(r.created_at),
    updated_at: (r) => q(r.updated_at),
  },
  d.sows
);
resetSeq('sows');

// Invoices are NOT seeded from the fixtures. demoData's single INV-2026-0001
// covers Apr 1-15, which straddles two of the fortnightly invoice periods the
// bulk section bills, so the same hours would be counted twice in the finance
// dashboard's revenue. seed-bulk.sql issues one invoice per fortnight instead,
// with line items priced off the actual approved hours.

// ── HOLIDAYS ──
// migration-011 seeds its own calendar; the unique index is (date, country,
// name), so conflicts land there rather than on the primary key.
insert(
  'holidays',
  {
    holiday_date: (r) => q(r.holiday_date),
    country: (r) => q(r.country),
    name: (r) => q(r.name),
  },
  d.holidays,
  '(holiday_date, country, name) DO NOTHING'
);

// ── LEAVE ──
say(``, `-- ── Leave ──`);
insert(
  'leave_balances',
  {
    id: (r) => q(r.id),
    user_id: (r) => q(r.user_id),
    leave_type: (r) => q(r.leave_type),
    year: (r) => q(r.year),
    total_days: (r) => q(r.total_days),
    used_days: (r) => q(r.used_days),
  },
  d.leaveBalances
);

insert(
  'leaves',
  {
    id: (r) => q(r.id),
    user_id: (r) => q(r.user_id),
    user_name: (r) => q(r.user_name),
    leave_type: (r) => q(r.leave_type),
    start_date: (r) => q(r.start_date),
    end_date: (r) => q(r.end_date),
    days_count: (r) => q(r.days_count),
    reason: (r) => q(r.reason),
    status: (r) => q(r.status),
    approved_by: (r) => q(r.approved_by),
    approved_at: (r) => q(r.approved_at),
    created_at: (r) => q(r.created_at),
  },
  d.leaves
);
resetSeq('leaves');

// ── TASKS ──
say(``, `-- ── Tasks ──`);
insert(
  'tasks',
  {
    id: (r) => q(r.id),
    user_id: (r) => q(r.user_id),
    user_name: (r) => q(r.user_name),
    assigned_by: (r) => q(r.assigned_by),
    assigned_by_name: (r) => q(r.assigned_by_name),
    title: (r) => q(r.title),
    description: (r) => q(r.description),
    date: (r) => q(r.date),
    priority: (r) => q(r.priority),
    status: (r) => q(r.status),
    estimated_hours: (r) => q(r.estimated_hours),
    actual_hours: (r) => q(r.actual_hours),
    completed_at: (r) => q(r.completed_at),
    created_at: (r) => q(r.created_at),
    updated_at: (r) => q(r.updated_at),
  },
  d.tasks
);
resetSeq('tasks');

// Timesheets are NOT seeded from the fixtures either. demoData labels its
// period 'Apr 1 - Apr 15, 2026', but the UI builds labels from
// getFortnightlyPeriods() in src/data/mockData.js -- 14-day periods off a
// Mon 5 Jan 2026 epoch, e.g. 'Apr 13 - Apr 26, 2026'. Timesheets are looked up
// by (user_id, period_label), so a fixture row with a label the UI never
// generates is invisible in the app and shows up only as an orphan row in
// history. seed-bulk.sql generates ten real periods for the whole roster.

// ── DOCUMENTS ──
// stored_name doubles as the storage path; these fixtures point at objects that
// do not exist in the bucket, so the rows list but the files will not open.
say(``, `-- ── Documents (metadata only — no files in the bucket) ──`);
insert(
  'documents',
  {
    id: (r) => q(r.id),
    user_id: (r) => q(r.user_id),
    doc_type: (r) => q(r.doc_type),
    original_name: (r) => q(r.original_name),
    stored_name: (r) => q(r.stored_name),
    file_size: (r) => q(r.file_size),
    mime_type: (r) => q(r.mime_type),
    uploaded_by: (r) => q(r.uploaded_by),
    uploaded_at: (r) => q(r.uploaded_at),
  },
  d.documents
);
resetSeq('documents');

// ── PERIODS / HIRING / MEETINGS / SALES ──
say(``, `-- ── Operations ──`);
insert(
  'frozen_periods',
  {
    id: (r) => q(r.id),
    period_label: (r) => q(r.period_label),
    project: (r) => q(r.project),
    frozen_at: (r) => q(r.frozen_at),
  },
  d.frozenPeriods
);
resetSeq('frozen_periods');

insert(
  'requirements',
  {
    id: (r) => q(r.id),
    title: (r) => q(r.title),
    description: (r) => q(r.description),
    project: (r) => q(r.project),
    location_type: (r) => q(r.location_type),
    location_detail: (r) => q(r.location_detail),
    positions_count: (r) => q(r.positions_count),
    skills: (r) => q(r.skills),
    priority: (r) => q(r.priority),
    status: (r) => q(r.status),
    created_by: (r) => q(r.created_by),
    created_at: (r) => q(r.created_at),
    updated_at: (r) => q(r.updated_at),
  },
  d.requirements
);
resetSeq('requirements');

insert(
  'meetings',
  {
    id: (r) => q(r.id),
    title: (r) => q(r.title),
    date: (r) => q(r.date),
    time: (r) => q(r.time),
    attendees: (r) => `${q(r.attendees)}::jsonb`,
    notes: (r) => q(r.notes),
    project: (r) => q(r.project),
    created_by: (r) => q(r.created_by),
    created_by_name: (r) => q(r.created_by_name),
    created_at: (r) => q(r.created_at),
    updated_at: (r) => q(r.updated_at),
  },
  d.meetings
);
resetSeq('meetings');

insert(
  'meeting_actions',
  {
    id: (r) => q(r.id),
    meeting_id: (r) => q(r.meeting_id),
    description: (r) => q(r.description),
    assigned_to: (r) => q(r.assigned_to),
    assigned_to_name: (r) => q(r.assigned_to_name),
    due_date: (r) => q(r.due_date),
    status: (r) => q(r.status),
    completed_at: (r) => q(r.completed_at),
    created_at: (r) => q(r.created_at),
  },
  d.meetingActions
);
resetSeq('meeting_actions');

insert(
  'sales_deals',
  {
    id: (r) => q(r.id),
    title: (r) => q(r.title),
    client_name: (r) => q(r.client_name),
    deal_value: (r) => q(r.deal_value),
    currency: (r) => q(r.currency),
    stage: (r) => q(r.stage),
    probability: (r) => q(r.probability),
    expected_close_date: (r) => q(r.expected_close_date),
    owner_id: (r) => q(r.owner_id),
    notes: (r) => q(r.notes),
    created_at: (r) => q(r.created_at),
    updated_at: (r) => q(r.updated_at),
  },
  d.salesDeals
);
resetSeq('sales_deals');

insert(
  'ninebox_placements',
  {
    id: (r) => q(r.id),
    user_id: (r) => q(r.user_id),
    user_name: (r) => q(r.user_name),
    hourly_rate: (r) => q(r.hourly_rate),
    project: (r) => q(r.project),
    potential: (r) => q(r.potential),
    performance: (r) => q(r.performance),
    period: (r) => q(r.period),
    notes: (r) => q(r.notes),
    placed_by: (r) => q(r.placed_by),
    placed_at: (r) => q(r.placed_at),
  },
  d.nineboxPlacements,
  '(user_id, period) DO NOTHING'
);
resetSeq('ninebox_placements');

// ── SOW RESOURCES ──
// Drives the billable/non-billable split on the consolidator dashboard and the
// SOW panel on each employee profile, both of which match on name.
say(``, `-- ── SOW resource roster (from scripts/import_sow.py) ──`);
insert(
  'sow_resources',
  {
    // Explicit ids: without them the serial default generates fresh keys on
    // every run, ON CONFLICT (id) never fires, and re-running duplicates the
    // whole roster.
    id: (_r, i) => q(i + 1),
    name: (r) => q(r.name),
    project: (r) => q(r.project),
    manager: (r) => q(r.manager),
    location: (r) => q(r.location),
    rate: (r) => q(r.rate),
    status: (r) => q(r.status),
    sow_number: (r) => q(r.sow_number),
    sow_file: (r) => q(r.sow_file),
    comments: (r) => q(r.comments),
  },
  sowResources,
  '(id) DO NOTHING'
);
resetSeq('sow_resources');

// ── ROSTER ENTRIES ──
// The client portal's own resource list. Mirrored from the active SOW roster so
// the Roster screen is not empty on first load.
say(``, `-- ── Client portal roster ──`);
const roster = sowResources
  .filter((r) => r.status === 'Active')
  .slice(0, 25)
  .map((r) => ({
    client_id: 'CLT001',
    name: r.name,
    role: r.project,
    project: r.project,
    billing_rate: r.rate,
    currency: 'USD',
    status: 'active',
    created_by: 'ADM001',
  }));
insert(
  'roster_entries',
  {
    id: (_r, i) => q(i + 1),
    client_id: (r) => q(r.client_id),
    name: (r) => q(r.name),
    role: (r) => q(r.role),
    project: (r) => q(r.project),
    billing_rate: (r) => q(r.billing_rate),
    currency: (r) => q(r.currency),
    status: (r) => q(r.status),
    created_by: (r) => q(r.created_by),
  },
  roster
);
resetSeq('roster_entries');

// ── REFERRALS ──
say(``, `-- ── Referrals ──`);
const referrals = [
  {
    id: 1, requirement_id: 1, candidate_name: 'Arun Joseph Arulsekar',
    candidate_email: 'arun.joseph@example.com', candidate_phone: '+91-9812345670',
    referred_by: '100530', referred_by_name: 'Mohammed Navazuddin',
    notes: '6 years Salesforce, strong LWC background. Available in 30 days.',
    status: 'shortlisted', created_at: '2026-03-28T09:15:00Z',
  },
  {
    id: 2, requirement_id: 3, candidate_name: 'Meera Sundaram',
    candidate_email: 'meera.s@example.com', candidate_phone: '+91-9812345671',
    referred_by: '100617', referred_by_name: 'Vimal David',
    notes: 'Full stack, React + Node. Worked on B2B commerce at previous employer.',
    status: 'submitted', created_at: '2026-04-05T11:40:00Z',
  },
  {
    id: 3, requirement_id: 5, candidate_name: 'Rakesh Verma',
    candidate_email: 'rakesh.verma@example.com', candidate_phone: '+91-9812345672',
    referred_by: '100459', referred_by_name: 'Vivekanandan Jeevanantham',
    notes: 'L2 support, ServiceNow certified.',
    status: 'rejected', created_at: '2026-04-12T15:05:00Z',
  },
];
insert(
  'referrals',
  {
    id: (r) => q(r.id),
    requirement_id: (r) => q(r.requirement_id),
    candidate_name: (r) => q(r.candidate_name),
    candidate_email: (r) => q(r.candidate_email),
    candidate_phone: (r) => q(r.candidate_phone),
    referred_by: (r) => q(r.referred_by),
    referred_by_name: (r) => q(r.referred_by_name),
    notes: (r) => q(r.notes),
    status: (r) => q(r.status),
    created_at: (r) => q(r.created_at),
  },
  referrals
);
resetSeq('referrals');

// ── EMPLOYEE SALARIES ──
// Reuse the existing hand-written seed verbatim; it already upserts.
say(
  ``,
  `-- ############################################################`,
  `-- # employee_salaries (from supabase/seed-009-employee-salaries.sql)`,
  `-- ############################################################`,
  ``,
  readFileSync(join(root, 'supabase/seed-009-employee-salaries.sql'), 'utf8').trimEnd()
);

// ── BULK DATA ──
say(
  ``,
  `-- ############################################################`,
  `-- # bulk demo data (supabase/_build/seed-bulk.sql)`,
  `-- ############################################################`,
  ``,
  readFileSync(join(here, 'seed-bulk.sql'), 'utf8').trimEnd()
);

// ── PASSWORDS ──
// Hashes must match src/lib/password.js: PBKDF2-SHA256, 100k iterations,
// 16-byte salt, 32-byte key, serialised as pbkdf2:iterations:saltHex:keyHex.
// The salt is derived from the password rather than random so that
// regenerating this file produces an identical diff.
const ITERATIONS = 100_000;
function demoHash(password) {
  const salt = createHash('sha256')
    .update(`vcc-demo-salt:${password}`)
    .digest()
    .subarray(0, 16);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2:${ITERATIONS}:${salt.toString('hex')}:${key.toString('hex')}`;
}

// Passwords are enforced by /auth/login in src/lib/supabaseApi.js, which only
// demands one when the row actually has a hash. The client portal
// (src/client/lib/supabaseApi.js) does NOT check passwords -- it authenticates
// on Employee ID alone -- so CLI001/CLI002 are intentionally left without one.
const PASSWORDS = [
  ['admin', 'Admin@2026', `role = 'admin'`],
  ['manager', 'Manager@2026', `role = 'manager'`],
  ['finance', 'Finance@2026', `role = 'finance'`],
  ['employee', 'Employee@2026', `role IN ('employee', 'consultant')`],
];

say(
  ``,
  `-- ############################################################`,
  `-- # demo passwords`,
  `-- #`,
  `-- # One shared password per role, so a walkthrough can sign in as`,
  `-- # anyone. PBKDF2-SHA256 / ${ITERATIONS} iterations, matching`,
  `-- # src/lib/password.js. Change them from the admin UI, or edit`,
  `-- # PASSWORDS in supabase/_build/build-seed.mjs and regenerate.`,
  `-- #`,
  `-- # These are demo credentials in a public git history. They are not`,
  `-- # secrets and must be rotated before this database holds real data.`,
  `-- ############################################################`
);
for (const [label, password, predicate] of PASSWORDS) {
  say(
    ``,
    `-- ${label}: ${password}`,
    `UPDATE users SET password_hash = ${q(demoHash(password))}`,
    `WHERE ${predicate} AND password_hash IS NULL;`
  );
}

say(``, `COMMIT;`);

writeFileSync(join(root, 'supabase/seed-demo.sql'), out.join('\n') + '\n');
console.log(`seed-demo.sql written — ${out.length} lines`);
