import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';
import { parseSharePointRow } from '../_lib/sharepoint-parser.js';

// Runs on Vercel Cron: every 15 min during business hours (vercel.json)
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: config } = await supabaseAdmin
    .from('integration_config')
    .select('config, is_active')
    .eq('provider', 'sharepoint')
    .single();

  if (!config?.is_active) {
    return res.status(200).json({ skipped: true, reason: 'SharePoint sync disabled' });
  }

  const SITE_ID = process.env.SHAREPOINT_SITE_ID;
  const LIST_ID = process.env.SHAREPOINT_LIST_ID;

  if (!SITE_ID || !LIST_ID) {
    return res.status(200).json({ skipped: true, reason: 'SharePoint not configured' });
  }

  const { data: syncLog } = await supabaseAdmin
    .from('sharepoint_sync_log')
    .insert({ sync_type: 'incremental', status: 'running' })
    .select('id')
    .single();

  try {
    // Get last successful sync time for incremental filter
    const { data: lastSync } = await supabaseAdmin
      .from('sharepoint_sync_log')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // Fetch items, optionally filtered by last modified
    let url = `/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields&$top=100`;
    if (lastSync?.completed_at) {
      url += `&$filter=fields/Modified ge '${lastSync.completed_at}'`;
    }

    let allItems = [];
    while (url) {
      const response = await graphFetch(url);
      allItems = allItems.concat(response.value || []);
      url = response['@odata.nextLink'] || null;
    }

    let synced = 0;
    let failed = 0;

    for (const item of allItems) {
      try {
        const parsed = parseSharePointRow(item.fields);
        if (!parsed || parsed.entries.length === 0) { failed++; continue; }

        {
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, name, project')
            .eq('id', parsed.employeeId)
            .single();

          const userId = user?.id || parsed.employeeId;
          const userName = user?.name || parsed.employeeName;
          const userProject = user?.project || parsed.project;
          const totalHours = parsed.entries.reduce((sum, e) => sum + e.hours, 0);

          const { data: ts, error: tsError } = await supabaseAdmin
            .from('timesheets')
            .upsert({
              user_id: userId,
              user_name: userName,
              user_project: userProject,
              period_label: parsed.periodLabel,
              status: 'submitted',
              total_hours: totalHours,
              sharepoint_synced: true,
              submitted_at: new Date().toISOString(),
            }, { onConflict: 'user_id,period_label' })
            .select('id')
            .single();

          if (tsError) throw tsError;

          const entryRows = parsed.entries.map(e => ({
            timesheet_id: ts.id,
            date: e.date,
            day_name: e.day_name,
            work_item: e.work_item,
            description: e.description,
            hours: e.hours,
            sharepoint_item_id: String(item.id),
          }));

          const { error: entryError } = await supabaseAdmin
            .from('timesheet_entries')
            .upsert(entryRows, { onConflict: 'timesheet_id,date' });

          if (entryError) throw entryError;

          synced++;
        }
      } catch {
        failed++;
      }
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

    return res.status(200).json({ success: true, synced, failed });
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
