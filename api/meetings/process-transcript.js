import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

/**
 * POST /api/meetings/process-transcript
 * Manually trigger AI processing for a meeting note (e.g., after pasting transcript)
 * Body: { noteId } or { noteId, transcript }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { noteId, transcript } = req.body || {};

  if (!noteId) return res.status(400).json({ error: 'noteId is required' });
  if (!CLAUDE_API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });

  try {
    // Fetch the meeting note
    const { data: note, error } = await supabaseAdmin
      .from('meeting_notes_ai')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error || !note) return res.status(404).json({ error: 'Meeting note not found' });

    const transcriptText = transcript || note.transcript_text;
    if (!transcriptText) return res.status(400).json({ error: 'No transcript text available' });

    // Update transcript if provided
    if (transcript) {
      await supabaseAdmin.from('meeting_notes_ai').update({
        transcript_text: transcript,
        transcript_source: 'manual',
        status: 'transcript_ready',
      }).eq('id', noteId);
    }

    // Process with Claude
    await supabaseAdmin.from('meeting_notes_ai').update({ status: 'processing' }).eq('id', noteId);

    const attendeeNames = JSON.parse(note.attendees || '[]').map(a => a.name || a.email).join(', ');

    const prompt = `You are an AI meeting assistant for D4 Insight. Analyze the following meeting transcript and produce structured meeting minutes.

Meeting: ${note.title}
Date: ${new Date(note.meeting_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Attendees: ${attendeeNames}

TRANSCRIPT:
${transcriptText.substring(0, 50000)}

Please respond with ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence executive summary of the meeting",
  "minutes_html": "<div>HTML formatted minutes with sections: Discussion Points, Decisions, Next Steps</div>",
  "key_decisions": [{"decision": "...", "context": "..."}],
  "action_items": [{"task": "description", "assignee": "person name", "due_date": "YYYY-MM-DD or null", "priority": "high/medium/low"}]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in Claude response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Update meeting note
    await supabaseAdmin.from('meeting_notes_ai').update({
      summary: parsed.summary,
      minutes_html: parsed.minutes_html,
      key_decisions: JSON.stringify(parsed.key_decisions || []),
      action_items: JSON.stringify(parsed.action_items || []),
      status: 'completed',
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', noteId);

    // Clear old action items, insert new
    await supabaseAdmin.from('meeting_action_items').delete().eq('meeting_note_id', noteId);

    const actionItems = parsed.action_items || [];
    if (actionItems.length > 0) {
      const { data: users } = await supabaseAdmin.from('users').select('id, name').eq('is_active', true);
      const userMap = new Map((users || []).map(u => [u.name?.toLowerCase(), u.id]));

      const rows = actionItems.map(item => ({
        meeting_note_id: noteId,
        task: item.task,
        assignee: item.assignee,
        assignee_user_id: userMap.get(item.assignee?.toLowerCase()) || null,
        due_date: item.due_date || null,
        status: 'open',
      }));

      await supabaseAdmin.from('meeting_action_items').insert(rows);
    }

    // Send email
    try {
      await sendMinutesEmail(note, parsed);
      await supabaseAdmin.from('meeting_notes_ai').update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      }).eq('id', noteId);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      summary: parsed.summary,
      actionItems: actionItems.length,
      decisionsCount: (parsed.key_decisions || []).length,
    });
  } catch (err) {
    await supabaseAdmin.from('meeting_notes_ai').update({
      status: 'failed',
      error_message: err.message,
    }).eq('id', noteId);
    return res.status(500).json({ error: err.message });
  }
}

async function sendMinutesEmail(note, parsed) {
  const attendees = JSON.parse(note.attendees || '[]');
  const recipientEmails = attendees.map(a => a.email).filter(Boolean);
  if (recipientEmails.length === 0) return;

  const meetingDate = new Date(note.meeting_date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const actionRows = (parsed.action_items || []).map(item =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${item.task}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${item.assignee || '-'}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${item.due_date || '-'}</td></tr>`
  ).join('');

  const htmlBody = `
  <div style="font-family:'Segoe UI',sans-serif;max-width:640px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 28px;border-radius:16px 16px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:18px;">Meeting Minutes</h2>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${note.title} — ${meetingDate}</p>
    </div>
    <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;">
      <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Summary</h3>
        <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">${parsed.summary}</p>
      </div>
      ${parsed.minutes_html ? `<div style="margin-bottom:20px;font-size:13px;color:#334155;line-height:1.6;">${parsed.minutes_html}</div>` : ''}
      ${actionRows ? `
      <h3 style="margin:0 0 12px;font-size:14px;color:#475569;">Action Items</h3>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;">
        <thead><tr style="background:#e2e8f0;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Task</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Assignee</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Due</th>
        </tr></thead>
        <tbody>${actionRows}</tbody>
      </table>` : ''}
    </div>
    <div style="padding:12px;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#f8fafc;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Generated by D4 Insight Meeting Assistant</p>
    </div>
  </div>`;

  const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';
  await graphFetch(`/users/${senderEmail}/sendMail`, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: `Meeting Minutes: ${note.title} — ${meetingDate}`,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: recipientEmails.map(email => ({ emailAddress: { address: email } })),
      },
    }),
  });
}
