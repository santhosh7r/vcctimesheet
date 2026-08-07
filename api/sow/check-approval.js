import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { getGraphToken } from '../_lib/graph-client.js';

const SENDER_EMAIL = 'sysadmin@d4insight.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sow_id } = req.body || {};
  if (!sow_id) return res.status(400).json({ error: 'sow_id required' });

  try {
    const { data: sow, error } = await supabaseAdmin
      .from('sows')
      .select('*')
      .eq('id', sow_id)
      .single();

    if (error || !sow) return res.status(404).json({ error: 'SOW not found' });
    if (sow.status !== 'submitted_for_finance') {
      return res.status(200).json({ status: sow.status, message: 'Not awaiting finance approval' });
    }

    const token = await getGraphToken();
    const senderEmail = process.env.AZURE_SENDER_EMAIL || SENDER_EMAIL;

    // Search ONLY for replies to the SOW approval email using sow_number
    // sow_number is unique like "SOW-2026-688737" so it won't match random emails
    const sowNumber = sow.sow_number;
    if (!sowNumber) {
      return res.status(200).json({ status: 'submitted_for_finance', message: 'No SOW number to search for' });
    }

    const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages?$search="${encodeURIComponent(sowNumber)}"&$top=20&$select=id,from,subject,receivedDateTime,body`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Graph search: ${r.status} ${errText}`);
    }
    const data = await r.json();
    const messages = data.value || [];

    const senderLower = senderEmail.toLowerCase();
    for (const msg of messages) {
      const fromAddr = (msg.from?.emailAddress?.address || '').toLowerCase();
      // Skip emails sent BY sysadmin (our own outgoing emails)
      if (fromAddr === senderLower) continue;

      const msgSubject = (msg.subject || '').toLowerCase();

      // CRITICAL: Only process emails whose subject contains the SOW number or "sow"
      // This prevents matching random unrelated emails (leave replies, etc.)
      const sowNumLower = sowNumber.toLowerCase();
      if (!msgSubject.includes(sowNumLower) && !msgSubject.includes('sow')) continue;

      // Strip HTML tags, get raw text
      const rawBody = (msg.body?.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

      // Extract just the reply text (before quoted original message)
      let replyText = rawBody;
      const separators = [
        /on .+ wrote:/i,
        /from: .+@.+/i,
        /-----original message-----/i,
        /_{3,}/,
        /reference: sow-approve/i,
        /statement of work no\./i,
      ];
      for (const sep of separators) {
        const idx = replyText.search(sep);
        if (idx > 10) {
          replyText = replyText.substring(0, idx).trim();
          break;
        }
      }

      const replyLower = replyText.toLowerCase();

      // ── APPROVED ──
      if (replyLower.includes('approved') || replyLower.includes('approve')) {
        // Make sure it's not "approved with changes" type
        if (replyLower.includes('change') || replyLower.includes('revise') || replyLower.includes('modify')) {
          // Fall through to changes_requested
        } else {
          const { error: e1 } = await supabaseAdmin.from('sows').update({
            status: 'finance_approved',
            finance_notes: replyText.trim() || 'Approved via email',
            updated_at: new Date().toISOString(),
          }).eq('id', sow.id);
          if (e1) throw new Error(`DB update failed: ${e1.message}`);

          return res.status(200).json({
            status: 'finance_approved',
            message: `Approved by ${fromAddr}`,
            notes: replyText.trim(),
          });
        }
      }

      // ── REJECTED ──
      if (replyLower.includes('rejected') || replyLower.includes('reject')) {
        const { error: e2 } = await supabaseAdmin.from('sows').update({
          status: 'rejected',
          finance_notes: replyText.trim() || 'Rejected via email',
          updated_at: new Date().toISOString(),
        }).eq('id', sow.id);
        if (e2) throw new Error(`DB update failed: ${e2.message}`);

        return res.status(200).json({
          status: 'rejected',
          message: `Rejected by ${fromAddr}`,
          reason: replyText.trim(),
        });
      }

      // ── CHANGES REQUESTED ──
      // Only if the reply clearly asks for changes (not just random words)
      const changePatterns = ['change', 'revise', 'modify', 'adjust', 'correct', 'instead of', 'should be', 'make it', 'needs to be', 'update the', 'please change'];
      const hasChangeRequest = changePatterns.some(kw => replyLower.includes(kw));

      if (hasChangeRequest) {
        const { error: e3 } = await supabaseAdmin.from('sows').update({
          status: 'changes_requested',
          finance_notes: replyText.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', sow.id);
        if (e3) throw new Error(`DB update failed: ${e3.message}`);

        return res.status(200).json({
          status: 'changes_requested',
          message: `Changes requested by ${fromAddr}`,
          changes: replyText.trim(),
        });
      }
    }

    return res.status(200).json({
      status: 'submitted_for_finance',
      message: 'No response found yet',
      emails_checked: messages.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
