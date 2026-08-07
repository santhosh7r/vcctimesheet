import { supabaseAdmin } from '../_lib/supabase-admin.js';

/**
 * Poll DocuSign for current envelope status (fallback if webhook misses).
 * Also can download the signed document.
 *
 * GET /api/sow/docusign-status?sow_id=123
 * GET /api/sow/docusign-status?sow_id=123&download=true  → returns signed PDF
 */

const DS_BASE = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
const DS_ACCOUNT = process.env.DOCUSIGN_ACCOUNT_ID;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { sow_id, download } = req.query;
  if (!sow_id) return res.status(400).json({ error: 'sow_id required' });

  try {
    const { data: sow, error } = await supabaseAdmin
      .from('sows')
      .select('*')
      .eq('id', sow_id)
      .single();

    if (error || !sow) return res.status(404).json({ error: 'SOW not found' });
    if (!sow.docusign_envelope_id || sow.docusign_envelope_id.startsWith('PENDING-DS-')) {
      return res.status(400).json({ error: 'No active DocuSign envelope' });
    }

    const accessToken = await getDocuSignToken();

    if (download === 'true') {
      // Download combined signed document
      const docResp = await fetch(
        `${DS_BASE}/v2.1/accounts/${DS_ACCOUNT}/envelopes/${sow.docusign_envelope_id}/documents/combined`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!docResp.ok) throw new Error(`DocuSign download: ${docResp.status}`);

      const buf = Buffer.from(await docResp.arrayBuffer());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${sow.sow_number || 'SOW'}-signed.pdf"`);
      return res.send(buf);
    }

    // Poll envelope status
    const envResp = await fetch(
      `${DS_BASE}/v2.1/accounts/${DS_ACCOUNT}/envelopes/${sow.docusign_envelope_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!envResp.ok) throw new Error(`DocuSign status: ${envResp.status}`);

    const envData = await envResp.json();
    const dsStatus = (envData.status || '').toLowerCase();

    // Sync status to our DB if changed
    if (dsStatus !== sow.docusign_status) {
      const updates = { docusign_status: dsStatus, updated_at: new Date().toISOString() };
      if (dsStatus === 'completed' && sow.status !== 'signed') {
        updates.status = 'signed';
        updates.manager_signed_at = envData.completedDateTime || new Date().toISOString();
      } else if (dsStatus === 'declined' && sow.status !== 'rejected') {
        updates.status = 'rejected';
        updates.rejection_reason = 'Declined via DocuSign';
        updates.rejected_at = new Date().toISOString();
      } else if (dsStatus === 'voided' && sow.status !== 'cancelled') {
        updates.status = 'cancelled';
      }
      await supabaseAdmin.from('sows').update(updates).eq('id', sow.id);
    }

    return res.status(200).json({
      envelope_id: sow.docusign_envelope_id,
      docusign_status: dsStatus,
      sow_status: sow.status,
      signer_email: sow.docusign_signer_email,
      sent_at: envData.sentDateTime,
      completed_at: envData.completedDateTime,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getDocuSignToken() {
  const pk = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const intKey = process.env.DOCUSIGN_INTEGRATION_KEY;

  if (!pk || !userId || !intKey) {
    throw new Error('DocuSign credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: intKey,
    sub: userId,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  })).toString('base64url');

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(pk.replace(/\\n/g, '\n'), 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const tokenResp = await fetch('https://account-d.docusign.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`DocuSign token: ${tokenResp.status} ${errText}`);
  }

  return (await tokenResp.json()).access_token;
}
