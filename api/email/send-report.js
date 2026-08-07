import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';
import { generatePdfFromHtml } from '../_lib/pdf-generator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipients, subject, htmlBody, period, reportType = 'consolidated' } = req.body || {};

  if (!recipients?.length || !subject) {
    return res.status(400).json({ error: 'recipients and subject are required' });
  }

  try {
    // Generate PDF attachment if HTML body provided
    let attachment = null;
    let pdfStoragePath = null;

    if (htmlBody) {
      const pdfBuffer = await generatePdfFromHtml(htmlBody);
      const fileName = `report_${reportType}_${period || 'latest'}_${Date.now()}.pdf`;

      // Store in Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('reports')
        .upload(fileName, pdfBuffer, { contentType: 'application/pdf' });

      if (!uploadError) {
        pdfStoragePath = fileName;
      }

      attachment = {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: fileName,
        contentType: 'application/pdf',
        contentBytes: pdfBuffer.toString('base64'),
      };
    }

    // Send via Graph API
    const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';

    await graphFetch(`/users/${senderEmail}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: htmlBody || `<p>Please find the ${reportType} report attached.</p>`,
          },
          toRecipients: recipients.map(email => ({
            emailAddress: { address: email },
          })),
          attachments: attachment ? [attachment] : [],
        },
      }),
    });

    // Log the report
    await supabaseAdmin.from('consolidation_reports').insert({
      report_type: reportType,
      period,
      emailed_to: recipients,
      pdf_storage_path: pdfStoragePath,
      generated_by: req.body.generatedBy || 'system',
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
