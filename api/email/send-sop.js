import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';
import { generatePdfFromHtml } from '../_lib/pdf-generator.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sopDocumentId, recipientEmail } = req.body || {};

  if (!sopDocumentId || !recipientEmail) {
    return res.status(400).json({ error: 'sopDocumentId and recipientEmail are required' });
  }

  try {
    // Get SOP document
    const { data: sopDoc, error } = await supabaseAdmin
      .from('sop_documents')
      .select('*, users(name, email, project)')
      .eq('id', sopDocumentId)
      .single();

    if (error || !sopDoc) {
      return res.status(404).json({ error: 'SOP document not found' });
    }

    // Generate approval token
    const approvalToken = crypto.randomUUID();

    // Generate PDF from rendered HTML
    const pdfBuffer = await generatePdfFromHtml(sopDoc.rendered_html);
    const fileName = `sop_${sopDoc.user_id}_${Date.now()}.pdf`;

    // Store PDF
    await supabaseAdmin.storage
      .from('documents')
      .upload(`sop/${fileName}`, pdfBuffer, { contentType: 'application/pdf' });

    // Update SOP document with token and status
    await supabaseAdmin
      .from('sop_documents')
      .update({
        status: 'sent',
        sent_to_email: recipientEmail,
        sent_at: new Date().toISOString(),
        approval_token: approvalToken,
        pdf_storage_path: `sop/${fileName}`,
      })
      .eq('id', sopDocumentId);

    // Send email via Graph API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.APP_URL || 'https://d4insight.com';

    const approveUrl = `${baseUrl}/api/sop/approve?token=${approvalToken}&action=approve`;
    const rejectUrl = `${baseUrl}/api/sop/approve?token=${approvalToken}&action=reject`;

    const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';

    await graphFetch(`/users/${senderEmail}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: `SOP Approval Required - ${sopDoc.users?.name || 'Employee'}`,
          body: {
            contentType: 'HTML',
            content: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e3a5f;">Statement of Procedures - Approval Required</h2>
                <p>Dear Client,</p>
                <p>Please review the attached Statement of Procedures (SOP) for <strong>${sopDoc.users?.name || 'the employee'}</strong> assigned to project <strong>${sopDoc.users?.project || 'N/A'}</strong>.</p>
                <p>Please click one of the buttons below to approve or reject:</p>
                <div style="margin: 30px 0;">
                  <a href="${approveUrl}" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; margin-right: 12px; font-weight: bold;">Approve</a>
                  <a href="${rejectUrl}" style="display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Reject</a>
                </div>
                <p style="color: #666; font-size: 12px;">This is an automated message from D4 Insight.</p>
              </div>
            `,
          },
          toRecipients: [{ emailAddress: { address: recipientEmail } }],
          attachments: [{
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: fileName,
            contentType: 'application/pdf',
            contentBytes: pdfBuffer.toString('base64'),
          }],
        },
      }),
    });

    return res.status(200).json({ success: true, approvalToken });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
