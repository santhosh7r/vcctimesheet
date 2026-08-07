import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';
import { parseSharePointRow } from '../_lib/sharepoint-parser.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SITE_ID = process.env.SHAREPOINT_SITE_ID;
  const LIST_ID = process.env.SHAREPOINT_LIST_ID;

  if (!SITE_ID || !LIST_ID) {
    return res.status(500).json({ error: 'SharePoint not configured' });
  }

  const { data: syncLog } = await supabaseAdmin
    .from('sharepoint_sync_log')
    .insert({ sync_type: req.body?.type || 'manual', status: 'running' })
    .select('id')
    .single();

  try {
    // Fetch ALL items with pagination
    let allItems = [];
    let nextUrl = `/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields&$top=200`;

    while (nextUrl) {
      const response = await graphFetch(nextUrl);
      allItems = allItems.concat(response.value || []);
      nextUrl = response['@odata.nextLink'] || null;
    }

    // Pre-fetch all users for fast lookup (include email for matching)
    const { data: allUsers } = await supabaseAdmin
      .from('users')
      .select('id, name, project, email');
    const userMap = Object.fromEntries((allUsers || []).map(u => [u.id, u]));

    let synced = 0;
    let failed = 0;

    // Parse all rows (1 row = 1 employee's full month, split into fortnightly periods)
    const parsed = [];
    for (const item of allItems) {
      try {
        const rows = parseSharePointRow(item.fields);
        if (rows && rows.length > 0) {
          for (const row of rows) {
            parsed.push({ ...row, itemId: item.id });
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Skip employees not in our database — do NOT auto-create users
    // (Employee list is managed via migration/admin panel, not SharePoint sync)
    // Build lookup maps: by name, by email, and by first+last name parts
    const nameMap = {};
    const emailMap = {};
    const firstLastMap = {};
    for (const u of allUsers || []) {
      nameMap[u.name.toLowerCase().trim()] = u;
      if (u.email) emailMap[u.email.toLowerCase().trim()] = u;
      // Also map by "firstname lastname" extracted from full name
      const parts = u.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        // Try first + last
        const firstLast = `${parts[0]} ${parts[parts.length - 1]}`.toLowerCase();
        firstLastMap[firstLast] = u;
      }
    }

    // Resolve each parsed row to an existing user (by ID → email → name → partial name)
    const unmatchedNames = [];
    for (const p of parsed) {
      if (userMap[p.employeeId]) continue; // Already matched by ID

      // Try email match
      if (p.email) {
        const emailMatch = emailMap[p.email.toLowerCase().trim()];
        if (emailMatch) {
          p.employeeId = emailMatch.id;
          continue;
        }
      }

      // Try exact name match
      if (p.employeeName) {
        const nameMatch = nameMap[p.employeeName.toLowerCase().trim()];
        if (nameMatch) {
          p.employeeId = nameMatch.id;
          continue;
        }

        // Try first+last name match (handles middle name differences)
        const spParts = p.employeeName.trim().split(/\s+/);
        if (spParts.length >= 2) {
          const spFirstLast = `${spParts[0]} ${spParts[spParts.length - 1]}`.toLowerCase();
          const partialMatch = firstLastMap[spFirstLast];
          if (partialMatch) {
            p.employeeId = partialMatch.id;
            continue;
          }
        }

        unmatchedNames.push(`${p.employeeName} (${p.employeeId})`);
      }
    }

    // Log unmatched for debugging
    if (unmatchedNames.length > 0) {
      console.warn('[SharePoint Sync] Unmatched employees:', [...new Set(unmatchedNames)]);
    }

    // Filter out any employees not in our database
    const validParsed = parsed.filter(p => userMap[p.employeeId]);

    // Merge entries per employee+period (cross-month periods like Apr 27–May 10
    // get entries from both the April and May SharePoint rows)
    const deduped = new Map();
    for (const p of validParsed) {
      const userId = p.employeeId;
      const key = `${userId}|${p.periodLabel}`;
      if (deduped.has(key)) {
        // Merge entries — combine from both months, dedup by date
        const existing = deduped.get(key);
        const entryByDate = new Map();
        for (const e of existing.entries) entryByDate.set(e.date, e);
        for (const e of p.entries) entryByDate.set(e.date, e); // newer wins per-date
        existing.entries = Array.from(entryByDate.values());
      } else {
        deduped.set(key, { ...p, entries: [...p.entries] });
      }
    }
    const uniqueParsed = Array.from(deduped.values());

    // Batch upsert timesheets in chunks (avoid duplicate key in single batch)
    const tsMap = {};
    const chunkSize = 100;
    for (let i = 0; i < uniqueParsed.length; i += chunkSize) {
      const chunk = uniqueParsed.slice(i, i + chunkSize);
      const timesheetRows = chunk.map(p => {
        const user = userMap[p.employeeId];
        return {
          user_id: user?.id || p.employeeId,
          user_name: user?.name || p.employeeName,
          user_project: user?.project || p.project,
          period_label: p.periodLabel,
          status: 'submitted',
          total_hours: p.entries.reduce((sum, e) => sum + e.hours, 0),
          sharepoint_synced: true,
          submitted_at: new Date().toISOString(),
        };
      });

      const { data: upsertedTs, error: tsError } = await supabaseAdmin
        .from('timesheets')
        .upsert(timesheetRows, { onConflict: 'user_id,period_label' })
        .select('id, user_id, period_label');

      if (tsError) throw tsError;

      for (const t of upsertedTs || []) {
        tsMap[`${t.user_id}|${t.period_label}`] = t.id;
      }
    }

    // Collect all entries, deduplicating by timesheet_id+date
    const entryMap = new Map();
    for (const p of uniqueParsed) {
      const userId = p.employeeId;
      const tsId = tsMap[`${userId}|${p.periodLabel}`];
      if (!tsId) { failed++; continue; }

      for (const e of p.entries) {
        const entryKey = `${tsId}|${e.date}`;
        entryMap.set(entryKey, {
          timesheet_id: tsId,
          date: e.date,
          day_name: e.day_name,
          work_item: e.work_item,
          description: e.description,
          hours: e.hours,
          sharepoint_item_id: String(p.itemId),
        });
      }
      synced++;
    }

    // Batch upsert entries in chunks
    const allEntries = Array.from(entryMap.values());
    for (let i = 0; i < allEntries.length; i += 500) {
      const chunk = allEntries.slice(i, i + 500);
      const { error: entryError } = await supabaseAdmin
        .from('timesheet_entries')
        .upsert(chunk, { onConflict: 'timesheet_id,date' });
      if (entryError) throw entryError;
    }

    await supabaseAdmin
      .from('sharepoint_sync_log')
      .update({
        status: 'completed',
        items_synced: synced,
        items_failed: failed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    const unmatchedUnique = [...new Set(unmatchedNames)];

    // Debug trace for specific employees (temporary)
    const debugIds = ['200037', '111103'];
    const debugTrace = {
      userMapHas200037: !!userMap['200037'],
      userMapHas111103: !!userMap['111103'],
      emailMapHasSwaminathan: !!emailMap['swaminathan.b@d4insight.com'],
      parsedWithId111103: parsed.filter(p => p.employeeId === '111103').length,
      parsedWithId200037: parsed.filter(p => p.employeeId === '200037').length,
      validParsedWith200037: uniqueParsed.filter(p => p.employeeId === '200037').length,
      tsMapKeysFor200037: Object.keys(tsMap).filter(k => k.startsWith('200037|')),
    };

    return res.status(200).json({ success: true, synced, failed, total: allItems.length, unmatched: unmatchedUnique.length, unmatchedNames: unmatchedUnique.slice(0, 20), debugTrace });
  } catch (err) {
    await supabaseAdmin
      .from('sharepoint_sync_log')
      .update({
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    return res.status(500).json({ error: err.message });
  }
}
