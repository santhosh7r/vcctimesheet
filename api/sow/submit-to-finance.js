import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';

const SENDER_EMAIL = 'sysadmin@d4insight.com';
const DEFAULT_FINANCE_EMAIL = process.env.FINANCE_APPROVER_EMAIL || 'gayathri.m@d4insight.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sow_id, custom_to, custom_subject, custom_body, sow_html } = req.body || {};
  if (!sow_id) return res.status(400).json({ error: 'sow_id required' });

  try {
    const { data: sow, error } = await supabaseAdmin
      .from('sows')
      .select('*')
      .eq('id', sow_id)
      .single();

    if (error || !sow) return res.status(404).json({ error: 'SOW not found' });
    if (sow.status !== 'draft') return res.status(400).json({ error: `SOW is already ${sow.status}` });

    // Get client name
    let clientName = 'Client';
    if (sow.client_id) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('name')
        .eq('id', sow.client_id)
        .single();
      if (client) clientName = client.name;
    }

    const recipientEmail = custom_to || DEFAULT_FINANCE_EMAIL;
    const approvalToken = `SOW-APPROVE-${sow.id}-${Date.now()}`;
    const subject = custom_subject || `SOW Approval Required: ${sow.title} - ${sow.sow_number || `ID-${sow.id}`}`;

    // Build email body: custom body text + SOW document as inline HTML
    const bodyText = (custom_body || '').replace(/\n/g, '<br>');
    const sowDocument = sow_html || '';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 780px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #ea580c); padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 18px;">SOW Approval Request</h1>
          <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 12px;">${sow.sow_number || 'New SOW'} - ${clientName}</p>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
          <div style="font-size: 14px; color: #334155; line-height: 1.7; margin-bottom: 24px;">${bodyText}</div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; margin: 20px 0;">
            <div style="background: #0f172a; color: white; padding: 8px 16px; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">
              ATTACHED: Statement of Work
            </div>
            <div style="padding: 16px; background: white; border-radius: 0 0 6px 6px;">
              ${sowDocument}
            </div>
          </div>

          <div style="margin-top: 24px; padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #92400e; font-weight: 600;">To approve or reject, please reply to this email with:</p>
            <ul style="margin: 0; padding: 0 0 0 20px; font-size: 13px; color: #92400e;">
              <li style="margin-bottom: 4px;"><b>APPROVED</b> - to approve this SOW</li>
              <li><b>REJECTED</b> (with reason) - to reject</li>
            </ul>
          </div>

          <p style="margin: 20px 0 0; font-size: 10px; color: #94a3b8;">Reference: ${approvalToken}</p>
        </div>
        <div style="padding: 12px 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background: #f8fafc;">
          <p style="margin: 0; font-size: 10px; color: #94a3b8;">D4 Insight - SOW Management</p>
        </div>
      </div>`;

    // Send email via Graph API
    const senderEmail = process.env.AZURE_SENDER_EMAIL || SENDER_EMAIL;
    await graphFetch(`/users/${senderEmail}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlContent },
          toRecipients: [{ emailAddress: { address: recipientEmail } }],
          importance: 'high',
        },
      }),
    });

    // Update SOW status — only use columns that exist
    const safeUpdate = {
      status: 'submitted_for_finance',
      updated_at: new Date().toISOString(),
    };

    // Try with extra columns first
    let updateResult = await supabaseAdmin.from('sows').update({
      ...safeUpdate,
      finance_submitted_at: new Date().toISOString(),
      finance_approval_token: approvalToken,
      finance_email_to: recipientEmail,
    }).eq('id', sow.id);

    if (updateResult.error) {
      // Extra columns don't exist, use safe columns only
      updateResult = await supabaseAdmin.from('sows').update(safeUpdate).eq('id', sow.id);
      if (updateResult.error) {
        throw new Error(`DB update failed: ${updateResult.error.message}`);
      }
    }

    return res.status(200).json({ success: true, message: `SOW sent to ${recipientEmail} for approval` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
