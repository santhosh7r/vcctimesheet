import { supabaseAdmin } from '../_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data: logs } = await supabaseAdmin
    .from('sharepoint_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);

  const latest = logs?.[0] || null;

  return res.status(200).json({
    latest,
    history: logs || [],
  });
}
