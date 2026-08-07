import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';

// Runs daily at 9am — checks for pending timesheets and sends reminders
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check if Teams integration is active
    const { data: config } = await supabaseAdmin
      .from('integration_config')
      .select('config, is_active')
      .eq('provider', 'microsoft365')
      .single();

    if (!config?.is_active || !config?.config?.teams_enabled) {
      return res.status(200).json({ skipped: true, reason: 'Teams not enabled' });
    }

    // Determine current period
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleDateString('en-US', { month: 'short' });
    const year = today.getFullYear();
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
    const currentPeriod = day <= 15
      ? `${month} 1 - ${month} 15, ${year}`
      : `${month} 16 - ${month} ${lastDay}, ${year}`;

    // Get all active employees
    const { data: employees } = await supabaseAdmin
      .from('users')
      .select('id, name, m365_user_id')
      .eq('is_active', true)
      .eq('role', 'employee');

    // Get submitted timesheets for current period
    const { data: submitted } = await supabaseAdmin
      .from('timesheets')
      .select('user_id')
      .eq('period_label', currentPeriod)
      .eq('status', 'submitted');

    const submittedUserIds = new Set((submitted || []).map(t => t.user_id));

    // Find employees who haven't submitted
    const pendingEmployees = (employees || []).filter(
      e => !submittedUserIds.has(e.id) && e.m365_user_id
    );

    let sent = 0;
    let failed = 0;

    for (const emp of pendingEmployees) {
      try {
        // Check if we already sent a reminder today
        const { data: existing } = await supabaseAdmin
          .from('notification_schedule')
          .select('id')
          .eq('user_id', emp.id)
          .eq('notification_type', 'timesheet_reminder')
          .gte('sent_at', today.toISOString().split('T')[0])
          .limit(1);

        if (existing?.length > 0) continue;

        const message = `<b>Timesheet Reminder</b><br/>Hi ${emp.name}, your timesheet for <b>${currentPeriod}</b> has not been submitted yet. Please submit it at your earliest convenience.`;

        // Create 1:1 chat and send message
        const chat = await graphFetch('/chats', {
          method: 'POST',
          body: JSON.stringify({
            chatType: 'oneOnOne',
            members: [
              {
                '@odata.type': '#microsoft.graph.aadUserConversationMember',
                roles: ['owner'],
                'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${emp.m365_user_id}`,
              },
              {
                '@odata.type': '#microsoft.graph.aadUserConversationMember',
                roles: ['owner'],
                'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${process.env.AZURE_BOT_USER_ID || emp.m365_user_id}`,
              },
            ],
          }),
        });

        await graphFetch(`/chats/${chat.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body: { contentType: 'html', content: message } }),
        });

        await supabaseAdmin.from('notification_schedule').insert({
          user_id: emp.id,
          notification_type: 'timesheet_reminder',
          channel: 'teams',
          message,
          sent_at: new Date().toISOString(),
          status: 'sent',
        });

        sent++;
      } catch (err) {
        await supabaseAdmin.from('notification_schedule').insert({
          user_id: emp.id,
          notification_type: 'timesheet_reminder',
          channel: 'teams',
          status: 'failed',
          error_message: err.message,
        });
        failed++;
      }
    }

    return res.status(200).json({
      success: true,
      period: currentPeriod,
      totalEmployees: employees?.length || 0,
      alreadySubmitted: submittedUserIds.size,
      remindersSent: sent,
      remindersFailed: failed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
