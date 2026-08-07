import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { getGraphToken } from '../_lib/graph-client.js';

const SENDER_EMAIL = 'sysadmin@d4insight.com';

// Runs every 30 min during business hours — scans sysadmin mailbox for leave emails
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = await getGraphToken();
    const graphGet = async (path) => {
      const url = `https://graph.microsoft.com/v1.0${path}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Graph GET ${path}: ${r.status}`);
      return r.json();
    };
    const graphPost = async (path, body) => {
      const url = `https://graph.microsoft.com/v1.0${path}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Graph POST ${path}: ${r.status} ${err}`);
      }
      return r.status === 202 ? {} : r.json().catch(() => ({}));
    };
    const graphPatch = async (path, body) => {
      const url = `https://graph.microsoft.com/v1.0${path}`;
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Graph PATCH ${path}: ${r.status} ${err}`);
      }
      return r.json().catch(() => ({}));
    };

    // Get emails from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const msgs = await graphGet(
      `/users/${SENDER_EMAIL}/messages?$filter=receivedDateTime ge ${since}&$top=50&$select=id,from,subject,receivedDateTime,body`
    );

    const messages = msgs.value || [];
    if (messages.length === 0) {
      return res.status(200).json({ success: true, scanned: 0, leaves: 0 });
    }

    // Get all active users for matching
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('is_active', true);

    // Get already-processed message IDs (check leaves table for recent entries to avoid duplicates)
    const { data: recentLeaves } = await supabaseAdmin
      .from('leaves')
      .select('reason')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const processedSubjects = new Set((recentLeaves || []).map(l => l.reason));

    let newLeaves = 0;

    for (const msg of messages) {
      const fromAddr = msg.from?.emailAddress?.address || '';
      const fromName = msg.from?.emailAddress?.name || '';
      const subject = msg.subject || '';
      const bodyText = (msg.body?.content || '').replace(/<[^>]+>/g, '').slice(0, 1000);

      // Skip if not a leave email
      const text = `${subject} ${bodyText}`.toLowerCase();
      if (!text.includes('leave') && !text.includes('sick') && !text.includes('day off')) continue;
      if (text.includes('wfh') && !text.includes('leave')) continue;

      // Skip if already processed
      if (processedSubjects.has(subject)) continue;

      // Match sender to a user
      const matchedUser = matchUser(fromAddr, fromName, subject, users);
      if (!matchedUser) continue;

      // Parse dates from subject/body
      const leaveDates = parseLeaveDates(subject, bodyText);
      if (leaveDates.length === 0) continue;

      const startDate = leaveDates[0];
      const endDate = leaveDates[leaveDates.length - 1];
      const daysCount = leaveDates.length;

      // Insert leave record
      await supabaseAdmin.from('leaves').insert({
        user_id: matchedUser.id,
        user_name: matchedUser.name,
        leave_type: text.includes('sick') ? 'sick' : 'casual',
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason: subject,
        status: 'approved',
      });

      // Do NOT auto-reply from sysadmin — no emails until app is fully complete

      newLeaves++;
    }

    return res.status(200).json({ success: true, scanned: messages.length, leaves: newLeaves });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function matchUser(fromAddr, fromName, subject, users) {
  const fromLower = fromAddr.toLowerCase();
  const nameLower = fromName.toLowerCase();

  for (const u of users) {
    // Match by email
    if (u.email && fromLower === u.email.toLowerCase()) return u;
    // Match by name in from field
    const uName = u.name.toLowerCase();
    const uFirst = uName.split(' ')[0];
    if (uFirst.length >= 4 && (nameLower.includes(uFirst) || fromLower.includes(uFirst))) return u;
    // Match name in subject
    if (subject.toLowerCase().includes(uFirst) && uFirst.length >= 5) return u;
  }
  return null;
}

function parseLeaveDates(subject, bodyText) {
  const text = `${subject} ${bodyText}`.toLowerCase();
  const today = new Date();
  const year = today.getFullYear();
  const dates = [];

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3,
    june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  // Pattern: "23rd April" or "23 Apr"
  const p1 = /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/gi;
  let m;
  while ((m = p1.exec(text)) !== null) {
    const day = parseInt(m[1]);
    const mon = monthMap[m[2].toLowerCase()];
    if (mon !== undefined && day >= 1 && day <= 31) {
      try { dates.push(new Date(year, mon, day)); } catch {}
    }
  }

  // Pattern: "April 23"
  const p2 = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
  while ((m = p2.exec(text)) !== null) {
    const mon = monthMap[m[1].toLowerCase()];
    const day = parseInt(m[2]);
    if (mon !== undefined && day >= 1 && day <= 31) {
      const d = new Date(year, mon, day);
      if (!dates.find(x => x.getTime() === d.getTime())) dates.push(d);
    }
  }

  // Pattern: dd/mm/yyyy
  const p3 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  while ((m = p3.exec(text)) !== null) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    if (!isNaN(d.getTime()) && !dates.find(x => x.getTime() === d.getTime())) dates.push(d);
  }

  // If no dates found, skip — do NOT assume today (could be a future leave intimation)
  // The leave will need to be manually entered or re-scanned once dates are specified

  // Filter to weekdays only and format
  return dates
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    .sort((a, b) => a - b)
    .map(d => d.toISOString().split('T')[0]);
}
