import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';

const SYSADMIN_EMAIL = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

/**
 * Cron: Runs every 30 min during business hours.
 * 1. Scans sysadmin calendar for meetings that ended in the last 60 min
 * 2. For new meetings, tries to pull Teams transcript
 * 3. If transcript available, processes with Claude AI
 * 4. Emails minutes to all attendees
 */
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const lookbackMs = 60 * 60 * 1000; // 60 minutes
    const startTime = new Date(now.getTime() - lookbackMs).toISOString();
    const endTime = now.toISOString();

    // Step 1: Fetch recently ended calendar events for sysadmin
    const calendarUrl = `/users/${SYSADMIN_EMAIL}/calendar/events?` +
      `$filter=end/dateTime ge '${startTime}' and end/dateTime le '${endTime}'` +
      `&$select=id,subject,start,end,organizer,attendees,onlineMeeting,isOnlineMeeting,bodyPreview` +
      `&$orderby=end/dateTime desc&$top=20`;

    let events = [];
    try {
      const calData = await graphFetch(calendarUrl);
      events = calData.value || [];
    } catch (err) {
      console.error('Calendar fetch error:', err.message);
      return res.status(200).json({ success: true, skipped: true, reason: 'Calendar fetch failed', error: err.message });
    }

    let processed = 0;
    let skipped = 0;
    let transcriptsFound = 0;

    for (const event of events) {
      // Skip non-meetings (all-day events, cancelled, etc.)
      if (!event.subject || event.subject.toLowerCase().includes('cancelled')) {
        skipped++;
        continue;
      }

      // Check if we already processed this event
      const { data: existing } = await supabaseAdmin
        .from('meeting_notes_ai')
        .select('id, status')
        .eq('calendar_event_id', event.id)
        .single();

      if (existing) {
        // If pending and has no transcript, try again
        if (existing.status !== 'pending' && existing.status !== 'no_transcript') {
          skipped++;
          continue;
        }
      }

      // Extract attendee info
      const attendees = (event.attendees || []).map(a => ({
        email: a.emailAddress?.address,
        name: a.emailAddress?.name,
        response: a.status?.response,
      }));

      const meetingStart = new Date(event.start?.dateTime + 'Z');
      const meetingEnd = new Date(event.end?.dateTime + 'Z');

      // Insert or update meeting record
      const noteData = {
        calendar_event_id: event.id,
        title: event.subject,
        meeting_date: meetingStart.toISOString(),
        meeting_end: meetingEnd.toISOString(),
        organizer: event.organizer?.emailAddress?.address,
        attendees: JSON.stringify(attendees),
        teams_meeting_url: event.onlineMeeting?.joinUrl || null,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      let noteId;
      if (existing) {
        await supabaseAdmin.from('meeting_notes_ai').update(noteData).eq('id', existing.id);
        noteId = existing.id;
      } else {
        const { data: inserted } = await supabaseAdmin
          .from('meeting_notes_ai')
          .insert(noteData)
          .select('id')
          .single();
        noteId = inserted?.id;
      }

      if (!noteId) { skipped++; continue; }

      // Step 2: Try to pull transcript if it's a Teams meeting
      let transcriptText = null;

      if (event.isOnlineMeeting && event.onlineMeeting?.joinUrl) {
        try {
          // Get online meeting ID from join URL
          const meetingId = await getOnlineMeetingId(event.onlineMeeting.joinUrl);
          if (meetingId) {
            transcriptText = await fetchTranscript(meetingId);
          }
        } catch (err) {
          console.log(`Transcript not available for "${event.subject}": ${err.message}`);
        }
      }

      if (transcriptText) {
        transcriptsFound++;
        await supabaseAdmin.from('meeting_notes_ai').update({
          transcript_text: transcriptText,
          transcript_source: 'teams_auto',
          status: 'transcript_ready',
        }).eq('id', noteId);

        // Step 3: Process with Claude AI
        await processWithClaude(noteId);
      } else {
        // Mark as no_transcript — user can paste manually
        await supabaseAdmin.from('meeting_notes_ai').update({
          status: 'no_transcript',
        }).eq('id', noteId);
      }

      processed++;
    }

    return res.status(200).json({
      success: true,
      eventsFound: events.length,
      processed,
      skipped,
      transcriptsFound,
    });
  } catch (err) {
    console.error('Meeting notes cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ──

async function getOnlineMeetingId(joinUrl) {
  try {
    // Decode the join URL to extract meeting ID
    // Teams join URLs contain encoded meeting info
    const meetings = await graphFetch(
      `/users/${SYSADMIN_EMAIL}/onlineMeetings?$filter=joinWebUrl eq '${encodeURIComponent(joinUrl)}'`
    );
    return meetings.value?.[0]?.id;
  } catch {
    return null;
  }
}

async function fetchTranscript(onlineMeetingId) {
  try {
    // List transcripts for the meeting
    const transcripts = await graphFetch(
      `/users/${SYSADMIN_EMAIL}/onlineMeetings/${onlineMeetingId}/transcripts`
    );

    if (!transcripts.value?.length) return null;

    // Get the latest transcript content
    const transcriptId = transcripts.value[0].id;
    const content = await graphFetch(
      `/users/${SYSADMIN_EMAIL}/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
      { headers: { Accept: 'text/vtt' } }
    );

    // The content might be returned as text, parse VTT to plain text
    return typeof content === 'string' ? parseVttToText(content) : JSON.stringify(content);
  } catch (err) {
    console.log('Transcript fetch failed:', err.message);
    return null;
  }
}

function parseVttToText(vtt) {
  // Parse WebVTT format to readable text
  const lines = vtt.split('\n');
  const textLines = [];
  let currentSpeaker = '';

  for (const line of lines) {
    // Skip VTT headers, timestamps, and empty lines
    if (line.startsWith('WEBVTT') || line.includes('-->') || line.trim() === '' || /^\d+$/.test(line.trim())) {
      continue;
    }
    // Extract speaker and text
    const speakerMatch = line.match(/^<v\s+([^>]+)>(.*)<\/v>$/);
    if (speakerMatch) {
      const speaker = speakerMatch[1];
      const text = speakerMatch[2];
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker;
        textLines.push(`\n${speaker}: ${text}`);
      } else {
        textLines.push(text);
      }
    } else if (line.trim()) {
      textLines.push(line.trim());
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

async function processWithClaude(noteId) {
  if (!CLAUDE_API_KEY) {
    await supabaseAdmin.from('meeting_notes_ai').update({
      status: 'failed',
      error_message: 'CLAUDE_API_KEY not configured',
    }).eq('id', noteId);
    return;
  }

  const { data: note } = await supabaseAdmin
    .from('meeting_notes_ai')
    .select('*')
    .eq('id', noteId)
    .single();

  if (!note?.transcript_text) return;

  try {
    await supabaseAdmin.from('meeting_notes_ai').update({ status: 'processing' }).eq('id', noteId);

    const prompt = `You are an AI meeting assistant for D4 Insight. Analyze the following meeting transcript and produce structured meeting minutes.

Meeting: ${note.title}
Date: ${new Date(note.meeting_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Attendees: ${JSON.parse(note.attendees || '[]').map(a => a.name || a.email).join(', ')}

TRANSCRIPT:
${note.transcript_text.substring(0, 50000)}

Please respond with ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence executive summary of the meeting",
  "minutes_html": "<div>...formatted HTML minutes with sections for Discussion Points, Decisions, Next Steps...</div>",
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
      throw new Error(`Claude API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in Claude response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Update meeting note with AI results
    await supabaseAdmin.from('meeting_notes_ai').update({
      summary: parsed.summary,
      minutes_html: parsed.minutes_html,
      key_decisions: JSON.stringify(parsed.key_decisions || []),
      action_items: JSON.stringify(parsed.action_items || []),
      status: 'completed',
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', noteId);

    // Insert action items into normalized table
    const actionItems = parsed.action_items || [];
    if (actionItems.length > 0) {
      // Try to match assignees to user IDs
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

    // Step 4: Send email to attendees
    await sendMinutesEmail(note, parsed);

  } catch (err) {
    console.error('Claude processing error:', err);
    await supabaseAdmin.from('meeting_notes_ai').update({
      status: 'failed',
      error_message: err.message,
    }).eq('id', noteId);
  }
}

async function sendMinutesEmail(note, parsed) {
  try {
    const attendees = JSON.parse(note.attendees || '[]');
    const recipientEmails = attendees
      .map(a => a.email)
      .filter(e => e && !e.includes('sysadmin'));

    if (recipientEmails.length === 0) return;

    const meetingDate = new Date(note.meeting_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const actionItemsHtml = (parsed.action_items || []).map(item =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${item.task}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${item.assignee || '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${item.due_date || '-'}</td>
      </tr>`
    ).join('');

    const decisionsHtml = (parsed.key_decisions || []).map(d =>
      `<li style="margin-bottom:6px;font-size:13px;"><strong>${d.decision}</strong>${d.context ? ` — ${d.context}` : ''}</li>`
    ).join('');

    const htmlBody = `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 28px;border-radius:16px 16px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">Meeting Minutes</h2>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${note.title} — ${meetingDate}</p>
      </div>
      <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;">
        <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:20px;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Summary</h3>
          <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">${parsed.summary}</p>
        </div>

        ${parsed.minutes_html ? `
        <div style="margin-bottom:20px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:#475569;">Minutes</h3>
          <div style="font-size:13px;color:#334155;line-height:1.6;">${parsed.minutes_html}</div>
        </div>` : ''}

        ${decisionsHtml ? `
        <div style="margin-bottom:20px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:#475569;">Key Decisions</h3>
          <ul style="margin:0;padding-left:20px;color:#334155;">${decisionsHtml}</ul>
        </div>` : ''}

        ${actionItemsHtml ? `
        <div style="margin-bottom:20px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:#475569;">Action Items</h3>
          <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#e2e8f0;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Task</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Assignee</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Due Date</th>
              </tr>
            </thead>
            <tbody>${actionItemsHtml}</tbody>
          </table>
        </div>` : ''}
      </div>
      <div style="padding:16px 28px;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#f8fafc;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">Generated by D4 Insight Meeting Assistant</p>
      </div>
    </div>`;

    // DISABLED: Do NOT send emails from sysadmin until app is fully complete
    // const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';
    // await graphFetch(`/users/${senderEmail}/sendMail`, { ... });

    await supabaseAdmin.from('meeting_notes_ai').update({
      email_sent: false,
      email_sent_at: null,
    }).eq('id', note.id);

  } catch (err) {
    console.error('Send minutes email error:', err.message);
  }
}
