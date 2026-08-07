import { supabaseAdmin } from '../_lib/supabase-admin.js';

/**
 * DocuSign Connect webhook — receives envelope status updates.
 * Configure in DocuSign Admin > Connect > Add Configuration:
 *   URL: https://<your-domain>/api/sow/docusign-webhook
 *   Events: Envelope Sent, Delivered, Completed, Declined, Voided
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // DocuSign Connect sends XML by default, but we configure JSON.
    // The payload structure for JSON is: { DocuSignEnvelopeInformation: { EnvelopeStatus: { ... } } }
    // Or with newer Connect: { event, apiVersion, uri, ... data: { envelopeId, ... } }
    let envelopeId, status, recipientEvents;

    if (body?.data?.envelopeId) {
      // Modern Connect format
      envelopeId = body.data.envelopeId;
      status = body.data.envelopeSummary?.status || body.event;
      recipientEvents = body.data.envelopeSummary?.recipients?.signers;
    } else if (body?.DocuSignEnvelopeInformation) {
      // Legacy Connect format
      const envStatus = body.DocuSignEnvelopeInformation.EnvelopeStatus;
      envelopeId = envStatus?.EnvelopeID;
      status = envStatus?.Status;
      recipientEvents = envStatus?.RecipientStatuses?.RecipientStatus;
    } else if (body?.envelopeId) {
      // Direct format (sometimes used in demo)
      envelopeId = body.envelopeId;
      status = body.status;
    } else {
      console.warn('DocuSign webhook: unrecognized payload format', JSON.stringify(body).slice(0, 500));
      return res.status(200).json({ received: true, warning: 'unrecognized format' });
    }

    if (!envelopeId) {
      return res.status(200).json({ received: true, warning: 'no envelopeId' });
    }

    console.log(`DocuSign webhook: envelope=${envelopeId} status=${status}`);

    // Find the SOW by envelope ID
    const { data: sow, error } = await supabaseAdmin
      .from('sows')
      .select('id, status, docusign_envelope_id')
      .eq('docusign_envelope_id', envelopeId)
      .single();

    if (error || !sow) {
      console.warn(`DocuSign webhook: no SOW found for envelope ${envelopeId}`);
      return res.status(200).json({ received: true, warning: 'envelope not matched' });
    }

    // Map DocuSign status to our SOW status
    const normalizedStatus = (status || '').toLowerCase();
    const updates = {
      docusign_status: normalizedStatus,
      updated_at: new Date().toISOString(),
    };

    if (normalizedStatus === 'completed') {
      updates.status = 'signed';
      updates.manager_signed_at = new Date().toISOString();
    } else if (normalizedStatus === 'declined') {
      updates.status = 'rejected';
      updates.rejection_reason = 'Declined via DocuSign';
      updates.rejected_at = new Date().toISOString();
    } else if (normalizedStatus === 'voided') {
      updates.status = 'cancelled';
    }
    // For 'sent', 'delivered' — just update docusign_status, keep SOW status as sent_for_signature

    await supabaseAdmin.from('sows').update(updates).eq('id', sow.id);

    return res.status(200).json({ received: true, envelopeId, status: normalizedStatus });
  } catch (err) {
    console.error('DocuSign webhook error:', err);
    // Always return 200 to prevent DocuSign from retrying
    return res.status(200).json({ received: true, error: err.message });
  }
}
