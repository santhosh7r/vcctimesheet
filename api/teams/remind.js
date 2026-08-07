import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userIds, message } = req.body || {};

  if (!userIds?.length || !message) {
    return res.status(400).json({ error: 'userIds and message are required' });
  }

  const results = [];

  for (const userId of userIds) {
    try {
      // Get user's M365 ID
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, name, m365_user_id')
        .eq('id', userId)
        .single();

      if (!user?.m365_user_id) {
        results.push({ userId, status: 'skipped', reason: 'No M365 user ID' });
        continue;
      }

      // Send Teams chat message
      // First, create or get 1:1 chat
      const chat = await graphFetch('/chats', {
        method: 'POST',
        body: JSON.stringify({
          chatType: 'oneOnOne',
          members: [
            {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              roles: ['owner'],
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${user.m365_user_id}`,
            },
            {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              roles: ['owner'],
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${process.env.AZURE_BOT_USER_ID || user.m365_user_id}`,
            },
          ],
        }),
      });

      // Send message
      await graphFetch(`/chats/${chat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: { contentType: 'html', content: message },
        }),
      });

      // Log notification
      await supabaseAdmin.from('notification_schedule').insert({
        user_id: userId,
        notification_type: 'teams_reminder',
        channel: 'teams',
        message,
        sent_at: new Date().toISOString(),
        status: 'sent',
      });

      results.push({ userId, status: 'sent' });
    } catch (err) {
      await supabaseAdmin.from('notification_schedule').insert({
        user_id: userId,
        notification_type: 'teams_reminder',
        channel: 'teams',
        message,
        status: 'failed',
        error_message: err.message,
      });
      results.push({ userId, status: 'failed', error: err.message });
    }
  }

  return res.status(200).json({ results });
}
