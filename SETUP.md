# Rebuilding the database and going live

The old Supabase project is gone. This rebuilds everything from scratch and
gets a demo in front of the client. Budget about 30 minutes.

There are two files, both generated. Run them in order, once each:

| File | What it does |
|---|---|
| `supabase/setup-all.sql` | Creates every table, index, policy, function and the storage bucket |
| `supabase/seed-demo.sql` | Loads demo data into all of them |

> **`setup-all.sql` is a one-time script, not a migration runner.**
> It bundles `migration-006-all-employees.sql`, which is a deliberate
> reset: it deletes all users, timesheets, timesheet entries, leaves,
> leave balances and 9-box placements before re-inserting the roster.
> Running it a second time against a database people have been using
> would discard everything they entered.
>
> A guard at the top of the script aborts with an explanatory error if
> any timesheet or leave rows already exist, so a stray re-run fails
> loudly instead of quietly wiping data. Re-running after a *partial*
> failure on a fresh database is still fine — nothing has been entered
> yet. `seed-demo.sql` is genuinely re-runnable either way.

Regenerate either after editing its inputs:

```bash
node supabase/_build/build-setup.mjs   # -> supabase/setup-all.sql
node supabase/_build/build-seed.mjs    # -> supabase/seed-demo.sql
```

---

## 1. Create the Supabase project

<https://supabase.com/dashboard> → **New project**.

- Pick the region closest to whoever is watching the demo.
- Save the database password somewhere; you will not see it again.
- Wait for provisioning to finish (~2 min) before step 2.

## 2. Build the schema

**SQL Editor** → **New query** → paste all of `supabase/setup-all.sql` → **Run**.

It is one script covering `schema.sql` plus all 23 migrations plus three tables
that were never captured in the migrations (see *What was missing* below). If it
fails partway on a fresh project, fix the cause and run it again — the guard only
trips once real activity exists.

Expect `Success. No rows returned.`

## 3. Load the demo data

New query → paste all of `supabase/seed-demo.sql` → **Run**.

This fills the whole app, not just a few tables:

| | |
|---|---|
| 76 users | full roster, all roles |
| 690 timesheets / 9,039 entries | 10 fortnightly periods × 69 people |
| 300 tasks, 146 leave requests | spread across the roster, some pending |
| 8 invoices / 120 line items | priced off the actual approved hours |
| 71 salary records | finance salary screens |
| 8 SOWs | one at every lifecycle stage |
| 414 KPI scores, 76 9-box placements | Q1–Q3 2026 |
| 140 documents, 36 SOPs | per-employee records |
| 66 SOW resources, 25 roster entries | billable/non-billable split |
| 3 AI meeting notes, 24 sales activities, 12 audit entries | |

The timesheet periods run from **Mar 30** to **Aug 16 2026**, so the demo opens
on a part-filled current timesheet, with one fortnight awaiting approval behind
it and eight approved periods of history.

Verify:

```sql
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'timesheets', count(*) FROM timesheets
UNION ALL SELECT 'timesheet_entries', count(*) FROM timesheet_entries
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'sows', count(*) FROM sows;
```

## 4. Point the app at it

**Project Settings → API**. Copy the Project URL and the `anon` `public` key.

Create `.env` locally:

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_USE_SUPABASE=true
VITE_VENDOR_TOOL_URL=https://<your-deployment>.vercel.app/vendor-tool
```

Do **not** set `VITE_SUPABASE_SERVICE_KEY`. See *About the keys* below.

```bash
npm install
npm run dev:client
```

Log in and click through the four portals before you deploy anything.

## 5. Deploy

```bash
npx vercel --prod
```

Add the same four `VITE_*` variables in **Vercel → Project → Settings →
Environment Variables**, then redeploy. Vite inlines `VITE_*` at build time, so
a variable added after a build does not reach the browser until you rebuild.

If you want the SharePoint sync, DocuSign and email functions live too, add the
server-side variables from `.env.example` as well. None of them are needed for
the demo — those screens degrade quietly without them.

---

## Demo logins

The login screen offers three portals: **Admin**, **Manager**, **Client**.

**Admin and Manager — email + password.** These go through the allowlist in
[src/lib/supabaseApi.js](src/lib/supabaseApi.js); the passwords live in that
file, not in the database. A portal only accepts an account whose `role`
matches the portal key.

| Portal | Email | Password | Resolves to |
|---|---|---|---|
| Admin | `kishan@d4insight.com` | `Kishan@D4#2026` | user 200048 |
| Admin | `sysadmin@d4insight.com` | `D45#as@18n%` | auto-provisioned |
| Manager | `kishore@d4insight.com` | `Manager@D4#2026` | user 100510, VCC - Partner Insight |

**Client Portal — Employee ID only, no password.**
[src/client/lib/supabaseApi.js](src/client/lib/supabaseApi.js) authenticates on
ID + `role='client'` and never checks a password.

| Portal | Employee ID | Who |
|---|---|---|
| Client Portal | `CLI002` | Client Manager — roster, vendors, timesheet approval |
| Client Portal | `CLI001` | Client Finance — SOW approval, invoices |

**Finance and Employee** have no portal card. Their routes still exist
(`/finance/*`, `/employee/*`) and are reachable from an admin session or by
navigating directly, but there is no way to sign in as them from the login
screen. The `financeindia@d4insight.com` entry is deliberately left in
`ALLOWED_LOGINS` so the Finance portal can be restored by adding its card back
to `portals` in [src/pages/Login.jsx](src/pages/Login.jsx) — until then the
portal check rejects it.

`seed-demo.sql` also sets a `password_hash` on every employee and manager row
(`Employee@2026` / `Manager@2026`). Those work against `/auth/login`, which the
current UI does not call — harmless, and it means an Employee-ID login path
works immediately if one is ever wired up. Defined by `PASSWORDS` in
`supabase/_build/build-seed.mjs`.

> These are demo credentials committed to git. They are not secrets. Rotate
> them, and the three in `supabaseApi.js`, before this database holds anything
> real.

---

## About the keys

The app does not use Supabase Auth. It authenticates users itself in
[src/lib/supabaseApi.js](src/lib/supabaseApi.js) and enforces roles in
application code. But the RLS policies in `schema.sql` and migrations 010-016
gate rows on `get_user_role()`, which reads `auth.uid()` — always NULL here.

So under a plain anon key those policies match nothing, and the finance, SOW,
vendor and roster screens all come back empty. Two ways out:

**A. Service role key in the browser** — what the code does today, via
`VITE_SUPABASE_SERVICE_KEY`. It bypasses RLS, and also hands anyone who opens
devtools full administrative control of the project: every table, Storage, the
lot.

**B. Open policies + anon key** — what `setup-all.sql` sets up, and what step 4
above uses. The last block of that script puts a permissive `demo_open_access`
policy on every table. Database access is still wide open, but the key in the
browser is only a data key: it cannot administer the project and it can be
rotated on its own.

B is the weaker of two weak options and it is the right one for a demo. Neither
is acceptable for real customer data. Replacing `demo_open_access` with real
per-role policies is the work that has to happen before this database holds
anything that is not demo data — and that means either moving to Supabase Auth
or moving these queries behind the serverless functions in `api/`, which already
have a service-role client in `api/_lib/supabase-admin.js`.

---

## What was missing

Three tables the app queries were created by hand in the old project and never
written into `schema.sql` or any migration. A database built only from the
tracked files would have been missing all three, and
`migration-022-referral-resume.sql` would have failed outright trying to `ALTER`
one that did not exist.

They are now defined in `supabase/_build/missing-tables.sql`, reconstructed from
the application's read and write sites:

- **`referrals`** — employee referrals against open requirements
  (`/referrals` in `src/lib/supabaseApi.js`)
- **`sow_resources`** — the SOW roster, matched to employees by name; drives the
  billable/non-billable split on the consolidator dashboard
- **`email_queue`** — outbound mail parked by the SOW submit-to-finance flow

One more gap: `CLI001`, the client finance login, is referenced by
`sows.finance_approved_by` but no migration creates it. `seed-demo.sql` does.

If any of these three tables had a different shape in the old project, the
reconstruction may differ in the details. `sow_resources` is the one to check
against the old data if you have a backup — the app reads `name`, `manager`,
`rate`, `status`, `sow_number` and `sow_file` from it.

---

## Files that are now redundant

`supabase/seed.sql` and `supabase/seed-009-employee-salaries.sql` predate this
and cover only part of the schema. `seed-demo.sql` supersedes `seed.sql`. They
are left in place; do not run them alongside the new files.
