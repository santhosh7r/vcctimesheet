import { supabaseAdmin } from '../_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token, action } = req.query || {};

  if (!token || !['approve', 'reject'].includes(action)) {
    return res.status(400).send(htmlPage('Invalid Request', 'The approval link is invalid or has expired.'));
  }

  try {
    // Find SOP document by approval token
    const { data: sopDoc } = await supabaseAdmin
      .from('sop_documents')
      .select('*, users(name, id)')
      .eq('approval_token', token)
      .single();

    if (!sopDoc) {
      return res.status(404).send(htmlPage('Not Found', 'This approval link is invalid or has already been used.'));
    }

    if (sopDoc.status === 'approved' || sopDoc.status === 'rejected') {
      return res.status(200).send(htmlPage(
        'Already Processed',
        `This SOP has already been <strong>${sopDoc.status}</strong>.`
      ));
    }

    if (action === 'approve') {
      await supabaseAdmin
        .from('sop_documents')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sopDoc.id);

      // Activate the employee
      await supabaseAdmin
        .from('users')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', sopDoc.user_id);

      return res.status(200).send(htmlPage(
        'Approved!',
        `The SOP for <strong>${sopDoc.users?.name || 'the employee'}</strong> has been approved. The employee is now active.`,
        'success'
      ));
    }

    if (action === 'reject') {
      // For rejection, show a form to collect a reason
      if (req.query.reason) {
        await supabaseAdmin
          .from('sop_documents')
          .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: req.query.reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sopDoc.id);

        return res.status(200).send(htmlPage(
          'Rejected',
          `The SOP for <strong>${sopDoc.users?.name || 'the employee'}</strong> has been rejected. The admin will be notified.`,
          'error'
        ));
      }

      // Show rejection form
      return res.status(200).send(`
        <!DOCTYPE html>
        <html><head><title>Reject SOP</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; margin: 0; }
          .card { background: white; border-radius: 16px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 4px 6px rgba(0,0,0,0.07); text-align: center; }
          textarea { width: 100%; min-height: 100px; border: 2px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 16px 0; font-family: Arial; resize: vertical; }
          button { padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
          button:hover { background: #dc2626; }
        </style></head>
        <body>
          <div class="card">
            <h2>Reject SOP</h2>
            <p>Please provide a reason for rejection:</p>
            <form method="GET">
              <input type="hidden" name="token" value="${token}" />
              <input type="hidden" name="action" value="reject" />
              <textarea name="reason" placeholder="Reason for rejection..." required></textarea>
              <button type="submit">Submit Rejection</button>
            </form>
          </div>
        </body></html>
      `);
    }
  } catch (err) {
    return res.status(500).send(htmlPage('Error', 'Something went wrong. Please contact the administrator.'));
  }
}

function htmlPage(title, message, type = 'info') {
  const colors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };
  return `
    <!DOCTYPE html>
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; margin: 0; }
      .card { background: white; border-radius: 16px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 4px 6px rgba(0,0,0,0.07); text-align: center; }
      h2 { color: ${colors[type]}; }
    </style></head>
    <body>
      <div class="card">
        <h2>${title}</h2>
        <p>${message}</p>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">D4 Insight</p>
      </div>
    </body></html>
  `;
}
