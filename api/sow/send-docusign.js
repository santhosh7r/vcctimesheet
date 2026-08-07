import { supabaseAdmin } from '../_lib/supabase-admin.js';

/**
 * Send SOW for DocuSign signature to client manager.
 *
 * Required env vars:
 *   DOCUSIGN_INTEGRATION_KEY   — OAuth integration key (client ID)
 *   DOCUSIGN_USER_ID           — Impersonated user ID (API consent)
 *   DOCUSIGN_ACCOUNT_ID        — DocuSign account ID
 *   DOCUSIGN_RSA_PRIVATE_KEY   — RSA private key for JWT auth
 *   DOCUSIGN_BASE_URL          — e.g. https://demo.docusign.net/restapi (demo) or https://na4.docusign.net/restapi (prod)
 */

const DS_BASE = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
const DS_ACCOUNT = process.env.DOCUSIGN_ACCOUNT_ID;
const DS_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sow_id, signer_name, signer_email } = req.body || {};
  if (!sow_id || !signer_email) {
    return res.status(400).json({ error: 'sow_id and signer_email required' });
  }

  try {
    const { data: sow, error } = await supabaseAdmin
      .from('sows')
      .select('*')
      .eq('id', sow_id)
      .single();

    if (error || !sow) return res.status(404).json({ error: 'SOW not found' });
    if (sow.status !== 'finance_approved') {
      return res.status(400).json({ error: `SOW must be finance_approved to send for signature (current: ${sow.status})` });
    }

    // Check if DocuSign is configured
    if (!DS_ACCOUNT || !DS_KEY) {
      // DocuSign not configured — create a placeholder envelope
      const demoEnvelopeId = `PENDING-DS-${sow.id}-${Date.now()}`;
      await supabaseAdmin.from('sows').update({
        status: 'sent_for_signature',
        docusign_envelope_id: demoEnvelopeId,
        docusign_status: 'pending_config',
        docusign_signer_name: signer_name || 'Client Manager',
        docusign_signer_email: signer_email,
        updated_at: new Date().toISOString(),
      }).eq('id', sow.id);

      return res.status(200).json({
        success: true,
        message: 'DocuSign not configured yet — SOW marked as sent_for_signature with placeholder',
        envelope_id: demoEnvelopeId,
        config_needed: true,
      });
    }

    // ── DocuSign JWT Auth ──
    const accessToken = await getDocuSignToken();

    // ── Create Envelope ──
    const fmtMoney = (n, c) => {
      const sym = c === 'INR' ? '₹' : c === 'EUR' ? '€' : '$';
      return `${sym}${Math.round(n || 0).toLocaleString('en-US')}`;
    };

    const envelopeBody = {
      emailSubject: `SOW for Signature: ${sow.title} — ${sow.sow_number || `ID-${sow.id}`}`,
      emailBlurb: `Please review and sign the attached Statement of Work: ${sow.title}`,
      recipients: {
        signers: [{
          email: signer_email,
          name: signer_name || 'Client Manager',
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [{
              anchorString: '/sig1/',
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '0',
            }],
            dateSignedTabs: [{
              anchorString: '/date1/',
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '0',
            }],
          },
        }],
      },
      documents: [{
        documentId: '1',
        name: `${sow.sow_number || 'SOW'}.html`,
        fileExtension: 'html',
        documentBase64: Buffer.from(buildSowHtml(sow, fmtMoney)).toString('base64'),
      }],
      status: 'sent',
    };

    const dsResp = await fetch(`${DS_BASE}/v2.1/accounts/${DS_ACCOUNT}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeBody),
    });

    if (!dsResp.ok) {
      const errText = await dsResp.text();
      throw new Error(`DocuSign API: ${dsResp.status} ${errText}`);
    }

    const dsData = await dsResp.json();

    await supabaseAdmin.from('sows').update({
      status: 'sent_for_signature',
      docusign_envelope_id: dsData.envelopeId,
      docusign_status: 'sent',
      docusign_signer_name: signer_name || 'Client Manager',
      docusign_signer_email: signer_email,
      updated_at: new Date().toISOString(),
    }).eq('id', sow.id);

    return res.status(200).json({
      success: true,
      envelope_id: dsData.envelopeId,
      message: `DocuSign envelope sent to ${signer_email}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getDocuSignToken() {
  // JWT Grant flow — requires DOCUSIGN_RSA_PRIVATE_KEY
  const pk = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const intKey = process.env.DOCUSIGN_INTEGRATION_KEY;

  if (!pk || !userId || !intKey) {
    throw new Error('DocuSign credentials not configured (DOCUSIGN_RSA_PRIVATE_KEY, DOCUSIGN_USER_ID, DOCUSIGN_INTEGRATION_KEY)');
  }

  // Build JWT
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

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

function buildSowHtml(sow, fmtMoney) {
  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; }
  h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { padding: 10px 14px; border: 1px solid #cbd5e1; text-align: left; font-size: 14px; }
  th { background: #f1f5f9; font-weight: 600; }
  .sig-block { margin-top: 60px; display: flex; gap: 80px; }
  .sig-line { border-top: 1px solid #334155; padding-top: 8px; margin-top: 40px; width: 250px; font-size: 13px; }
</style></head><body>
  <h1>Statement of Work</h1>
  <p><strong>SOW Number:</strong> ${sow.sow_number || 'TBD'}</p>
  <p><strong>Title:</strong> ${sow.title}</p>
  <table>
    <tr><th>Type</th><td style="text-transform:capitalize">${sow.sow_type || 'project'}</td></tr>
    <tr><th>Contract Value</th><td>${fmtMoney(sow.contract_value, sow.currency)}</td></tr>
    ${sow.start_date ? `<tr><th>Start Date</th><td>${sow.start_date}</td></tr>` : ''}
    ${sow.end_date ? `<tr><th>End Date</th><td>${sow.end_date}</td></tr>` : ''}
    ${sow.resource_name ? `<tr><th>Resource</th><td>${sow.resource_name} — ${sow.resource_role || 'N/A'} ($${sow.resource_rate || 0}/hr)</td></tr>` : ''}
  </table>
  ${sow.description ? `<h2>Description</h2><p>${sow.description}</p>` : ''}
  <div class="sig-block">
    <div>
      <div>/sig1/</div>
      <div class="sig-line">Client Authorized Signatory</div>
      <div>/date1/</div>
    </div>
  </div>
</body></html>`;
}
