import { supabase } from './supabase';
import { EMPLOYEE_SALARIES } from '../data/employeeSalaries';
import { hashPassword, verifyPassword } from './password';

// ── Audit Logger ──
async function logAudit({ action, target_type, target_id, details }) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    let userName = null, userRole = null;
    if (userId) {
      const { data } = await supabase.from('users').select('name, role').eq('id', userId).single();
      if (data) { userName = data.name; userRole = data.role; }
    }
    await supabase.from('audit_logs').insert({
      user_id: userId, user_name: userName, user_role: userRole,
      action, target_type, target_id,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (e) {
    console.warn('[Audit] Failed to log:', e.message);
  }
}

// Normalize legacy 'consolidator' role to 'admin' (DB migration may lag)
function normalizeRole(role) {
  return role === 'consolidator' ? 'admin' : role;
}

// Strip password_hash from user objects before returning to frontend
function sanitizeUser(u) {
  if (!u) return u;
  const { password_hash, ...safe } = u;
  safe.role = normalizeRole(safe.role);
  return safe;
}

// ── Helpers ──
function parseQuery(url) {
  const params = {};
  const q = url.split('?')[1];
  if (!q) return params;
  q.split('&').forEach(p => {
    const [k, v] = p.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return params;
}

function matchRoute(method, path) {
  const p = path.split('?')[0].replace(/^\/api/, '');
  return { method, path: p, query: parseQuery(path) };
}

// ── Supabase API handler (same interface as mockFetch) ──
export async function supabaseFetch(method, path, body) {
  const { path: p, query } = matchRoute(method, path);

  // ── AUTH ──
  if (p === '/auth/login' && method === 'POST') {
    // Try exact match first, then fallback without role filter (handles DB role migration lag)
    let data, error;
    ({ data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', body.employeeId)
      .eq('role', body.role)
      .eq('is_active', true)
      .single());
    if (error || !data) {
      // Fallback: find user by ID only (role may differ in DB during migration)
      ({ data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', body.employeeId)
        .eq('is_active', true)
        .single());
    }
    if (error || !data) {
      logAudit({ action: 'login_failed', target_type: 'user', target_id: body.employeeId, details: { reason: 'user_not_found', role: body.role } });
      throw new Error('Invalid credentials');
    }
    // Verify password if user has one set
    if (data.password_hash) {
      if (!body.password) {
        await logAudit({ action: 'login_failed', target_type: 'user', target_id: body.employeeId, details: { reason: 'password_required' } });
        throw new Error('Password is required');
      }
      const valid = await verifyPassword(body.password, data.password_hash);
      if (!valid) {
        await logAudit({ action: 'login_failed', target_type: 'user', target_id: body.employeeId, details: { reason: 'wrong_password' } });
        throw new Error('Invalid credentials');
      }
    }
    const token = `sb-token-${data.id}`;
    await logAudit({ action: 'login', target_type: 'user', target_id: data.id, details: { role: data.role } });
    return { token, user: sanitizeUser(data) };
  }

  // Email + password login — strict allowlist. No other email can sign in.
  // Update ALLOWED_LOGINS below to change passwords or allowed accounts.
  //
  // `role` must match the portal key the login screen sends (see `portals` in
  // src/pages/Login.jsx), otherwise the portal check below rejects the sign-in.
  // The finance entry is kept so the Finance portal can be restored by adding
  // its card back; with no finance card on the login screen it is unreachable.
  if (p === '/auth/email-login' && method === 'POST') {
    // Change these passwords inline anytime — they're the only thing that lets a user in.
    const ALLOWED_LOGINS = {
      'kishan@d4insight.com':       { password: 'Kishan@D4#2026', role: 'admin' },
      'sysadmin@d4insight.com':     { password: 'D45#as@18n%',    role: 'admin' },
      // Resolves to user 100510 (Kishore, VCC - Partner Insight) by email.
      'kishore@d4insight.com':      { password: 'Manager@D4#2026', role: 'manager' },
      'financeindia@d4insight.com': { password: 'Finance@D4#2026', role: 'finance' },
    };
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const portal = (body.portal || '').toLowerCase(); // 'admin' | 'manager' | 'finance'
    if (!email || !password) throw new Error('Email and password required');
    const allowed = ALLOWED_LOGINS[email];
    if (!allowed) {
      await logAudit({ action: 'email_login_failed', target_type: 'user', details: { email, reason: 'not_allowlisted' } });
      throw new Error('This email is not authorized to sign in');
    }
    if (password !== allowed.password) {
      await logAudit({ action: 'email_login_failed', target_type: 'user', details: { email, reason: 'wrong_password' } });
      throw new Error('Wrong password');
    }
    if (portal && portal !== allowed.role) {
      await logAudit({ action: 'email_login_failed', target_type: 'user', details: { email, reason: 'wrong_portal', portal_picked: portal, actual_role: allowed.role } });
      throw new Error(`This account belongs to the ${allowed.role} portal, not ${portal}`);
    }
    // Look up the matching user row. Auto-create on first login so admins don't
    // have to seed the row by hand — the email is already on the allowlist, so
    // creating a row is safe (otherwise we'd have rejected above).
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (!error && !data) {
      const defaultIds = {
        'kishan@d4insight.com': 'KISHAN',
        'sysadmin@d4insight.com': 'SYSADM',
        'financeindia@d4insight.com': 'FININD',
      };
      const defaultNames = {
        'kishan@d4insight.com': 'Kishan',
        'sysadmin@d4insight.com': 'Sys Admin',
        'financeindia@d4insight.com': 'Finance India',
      };
      const insertPayload = {
        id: defaultIds[email] || email.split('@')[0].toUpperCase().slice(0, 12),
        name: defaultNames[email] || email.split('@')[0],
        role: allowed.role,
        designation: allowed.role === 'finance' ? 'Finance' : 'Admin',
        email,
        is_active: true,
        start_date: new Date().toISOString().slice(0, 10),
        hourly_rate: 0,
      };
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert(insertPayload)
        .select()
        .single();
      if (createErr) {
        await logAudit({ action: 'email_login_failed', target_type: 'user', details: { email, reason: 'auto_create_failed', error: createErr.message } });
        throw new Error(`Could not provision user: ${createErr.message}`);
      }
      data = created;
      await logAudit({ action: 'user_auto_provisioned', target_type: 'user', target_id: data.id, details: { email, role: allowed.role } });
    }
    if (error || !data) {
      await logAudit({ action: 'email_login_failed', target_type: 'user', details: { email, reason: 'user_row_lookup_error', error: error?.message } });
      throw new Error(`Login lookup failed: ${error?.message || 'unknown'}`);
    }
    // If user exists but inactive, reactivate them since they just logged in successfully.
    if (data.is_active === false) {
      await supabase.from('users').update({ is_active: true }).eq('id', data.id);
      data.is_active = true;
    }
    const token = `sb-token-${data.id}`;
    await logAudit({ action: 'email_login', target_type: 'user', target_id: data.id, details: { email, role: allowed.role } });
    return { token, user: sanitizeUser(data) };
  }

  // SSO login — called by AuthContext after Supabase Auth completes a Microsoft sign-in.
  // We look up the matching user in our users table by email (case-insensitive).
  // Unknown emails are rejected — Microsoft sign-in alone isn't enough; the user
  // must also be provisioned in the app.
  if (p === '/auth/sso-login' && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    if (!email) throw new Error('Email is required');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) {
      await logAudit({ action: 'sso_login_failed', target_type: 'user', details: { email, reason: 'not_provisioned' } });
      throw new Error(`Sign-in succeeded with Microsoft but no active user found for ${email}. Ask an admin to provision your account.`);
    }
    const token = `sb-token-${data.id}`;
    await logAudit({ action: 'sso_login', target_type: 'user', target_id: data.id, details: { email, provider: 'azure' } });
    return { token, user: sanitizeUser(data) };
  }

  if (p === '/auth/me') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    if (!token) throw new Error('Unauthorized');
    const userId = token.replace('sb-token-', '').replace('demo-token-', '');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) throw new Error('User not found');
    return { user: sanitizeUser(data) };
  }

  // ── USERS-PUBLIC ──
  if (p === '/users-public') {
    let q = supabase.from('users').select('id, name, role, project, designation, client_subrole').eq('is_active', true);
    if (query.role) q = q.eq('role', query.role);
    const { data } = await q;
    return { users: (data || []).map(u => ({ ...u, role: normalizeRole(u.role) })) };
  }

  // ── USERS ──
  if (p === '/users' && method === 'GET') {
    let q = supabase.from('users').select('*');
    if (query.include_all !== 'true') q = q.eq('is_active', true);
    if (query.role) q = q.eq('role', query.role);
    if (query.project) q = q.eq('project', query.project);
    q = q.order('name');
    const { data } = await q;
    return { users: (data || []).map(sanitizeUser) };
  }
  if (p.match(/^\/users\/[^/]+$/) && method === 'GET') {
    const id = p.split('/')[2];
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) throw new Error('User not found');
    return { user: sanitizeUser(data) };
  }
  if (p === '/users' && method === 'POST') {
    const newUser = {
      id: body.id,
      name: body.name,
      role: body.role,
      designation: body.designation,
      project: body.project,
      start_date: body.start_date || body.startDate,
      end_date: body.end_date || body.endDate,
      hourly_rate: body.hourly_rate || body.hourlyRate || 0,
      is_active: body.is_active !== undefined ? body.is_active : true,
      is_archived: body.is_archived || false,
      employee_status: body.employee_status || 'active',
      email: body.email,
      phone: body.phone,
    };
    // Client-portal login linkage (only set when creating a client user)
    if (body.role === 'client') {
      newUser.client_id = body.client_id || null;
      newUser.client_subrole = body.client_subrole || 'manager';
    }
    // Hash password if provided
    if (body.password) {
      newUser.password_hash = await hashPassword(body.password);
    }
    const { data, error } = await supabase.from('users').insert(newUser).select().single();
    if (error) throw new Error(error.message);
    // Seed leave balances (internal staff only — client logins don't take leave)
    if (body.role !== 'client') {
      const balances = ['casual', 'sick', 'earned'].map(type => ({
        id: `${newUser.id}_${type}`,
        user_id: newUser.id,
        leave_type: type,
        year: new Date().getFullYear(),
        total_days: type === 'casual' ? 12 : type === 'sick' ? 10 : 15,
        used_days: 0,
      }));
      await supabase.from('leave_balances').insert(balances);
    }
    await logAudit({ action: 'create_user', target_type: 'user', target_id: newUser.id, details: { role: newUser.role, name: newUser.name } });
    return { user: sanitizeUser(data) };
  }
  if (p.match(/^\/users\/[^/]+$/) && method === 'PUT') {
    const id = p.split('/')[2];
    const updates = { ...body, updated_at: new Date().toISOString() };
    // Hash password if being changed
    if (updates.password && updates.password.trim()) {
      updates.password_hash = await hashPassword(updates.password);
    }
    delete updates.password; // Never store plaintext
    const { data } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    await logAudit({ action: 'update_user', target_type: 'user', target_id: id, details: { changed_fields: Object.keys(body).filter(k => k !== 'password') } });
    return { user: sanitizeUser(data) };
  }
  if (p.match(/^\/users\/[^/]+$/) && method === 'DELETE') {
    const id = p.split('/')[2];
    // Delete related data first (FK constraints)
    await supabase.from('timesheet_entries').delete().in(
      'timesheet_id',
      (await supabase.from('timesheets').select('id').eq('user_id', id)).data?.map(t => t.id) || []
    );
    await supabase.from('timesheets').delete().eq('user_id', id);
    await supabase.from('leaves').delete().eq('user_id', id);
    await supabase.from('leave_balances').delete().eq('user_id', id);
    await supabase.from('ninebox_placements').delete().eq('user_id', id);
    await supabase.from('users').delete().eq('id', id);
    await logAudit({ action: 'delete_user', target_type: 'user', target_id: id });
    return { success: true };
  }

  // ── SET/RESET PASSWORD (admin action) ──
  if (p.match(/^\/users\/[^/]+\/set-password$/) && method === 'POST') {
    const id = p.split('/')[2];
    if (!body.password || body.password.length < 6) throw new Error('Password must be at least 6 characters');
    const hash = await hashPassword(body.password);
    const { error } = await supabase.from('users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit({ action: 'set_password', target_type: 'user', target_id: id });
    return { success: true };
  }

  // ── TIMESHEETS ──
  if (p === '/timesheets' && method === 'GET') {
    const { userId, period } = query;
    if (userId && period) {
      const { data } = await supabase
        .from('timesheets')
        .select('*, timesheet_entries(*)')
        .eq('user_id', userId)
        .eq('period_label', period)
        .maybeSingle();
      if (data && data.timesheet_entries) {
        data.entries = data.timesheet_entries;
        delete data.timesheet_entries;
      }
      return { timesheet: data };
    }
    return { timesheet: null };
  }
  if (p.match(/^\/timesheets\/user\/[^/]+$/) && method === 'GET') {
    const userId = p.split('/')[3];
    const { data } = await supabase
      .from('timesheets')
      .select('*, timesheet_entries(*)')
      .eq('user_id', userId);
    const timesheets = (data || []).map(t => {
      t.entries = t.timesheet_entries || [];
      delete t.timesheet_entries;
      return t;
    });
    return { timesheets };
  }
  if (p === '/timesheets/all' && method === 'GET') {
    let q = supabase.from('timesheets').select('*, timesheet_entries(*)');
    if (query.period) q = q.eq('period_label', query.period);
    const { data } = await q;
    const timesheets = (data || []).map(t => {
      t.entries = t.timesheet_entries || [];
      delete t.timesheet_entries;
      return t;
    });
    return { timesheets };
  }
  if (p === '/timesheets' && method === 'POST') {
    const { userId, periodLabel, entries, status = 'saved' } = body;
    // Get user info for denormalized fields. Callers (e.g. admin pushing a
    // timesheet to a client) may override the project so it shows under the
    // client's billable project rather than the employee's home project.
    const { data: userData } = await supabase.from('users').select('name, project').eq('id', userId).single();
    const userName = body.userName || userData?.name || '';
    const userProject = body.userProject || userData?.project || '';
    const totalHours = (entries || []).reduce((s, e) => s + (Number(e.hours) || 0), 0);

    // Upsert timesheet
    const { data: existing } = await supabase
      .from('timesheets')
      .select('id')
      .eq('user_id', userId)
      .eq('period_label', periodLabel)
      .maybeSingle();

    let timesheetId;
    if (existing) {
      timesheetId = existing.id;
      await supabase
        .from('timesheets')
        .update({ status, user_name: userName, user_project: userProject, total_hours: totalHours, updated_at: new Date().toISOString() })
        .eq('id', timesheetId);
      // Replace entries
      await supabase.from('timesheet_entries').delete().eq('timesheet_id', timesheetId);
    } else {
      const { data: newTs } = await supabase
        .from('timesheets')
        .insert({ user_id: userId, user_name: userName, user_project: userProject, period_label: periodLabel, status, total_hours: totalHours })
        .select('id')
        .single();
      timesheetId = newTs.id;
    }

    // Insert entries
    if (entries && entries.length > 0) {
      const rows = entries.map(e => ({
        timesheet_id: timesheetId,
        date: e.date,
        day_name: e.day_name,
        work_item: e.work_item,
        description: e.description,
        hours: e.hours || 0,
      }));
      await supabase.from('timesheet_entries').insert(rows);
    }
    return { success: true, id: timesheetId };
  }
  if (p.match(/^\/timesheets\/\d+\/submit$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    await supabase
      .from('timesheets')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', id);
    return { success: true };
  }

  // ── FREEZE ──
  if (p === '/freeze' && method === 'GET') {
    if (!query.period) return { frozen: false };
    let q = supabase.from('frozen_periods').select('*').eq('period_label', query.period);
    if (query.project) {
      q = q.or(`project.eq.${query.project},project.is.null`);
    } else {
      q = q.is('project', null);
    }
    const { data } = await q.maybeSingle();
    return { frozen: !!data, frozenPeriod: data || null };
  }
  if (p === '/freeze/all' && method === 'GET') {
    const { data } = await supabase.from('frozen_periods').select('*');
    return { frozenPeriods: data || [] };
  }
  if (p === '/freeze' && method === 'POST') {
    await supabase.from('frozen_periods').insert({
      period_label: body.periodLabel,
      project: body.project || null,
    });
    return { success: true };
  }

  // ── DOCUMENTS ──
  if (p === '/documents' && method === 'GET') {
    let q = supabase.from('documents').select('*');
    if (query.userId) q = q.eq('user_id', query.userId);
    const { data } = await q;
    return { documents: data || [] };
  }
  if (p === '/documents' && method === 'POST') {
    const userId = body.userId || body.get?.('userId');
    const docType = body.docType || body.get?.('docType');
    const uploadedBy = body.uploadedBy || 'ADM001';
    const fileName = body.fileName || 'Uploaded_Document.pdf';
    const storagePath = body.storagePath || null;

    const { data, error } = await supabase.from('documents').insert({
      user_id: userId,
      doc_type: docType,
      original_name: fileName,
      stored_name: `doc_${Date.now()}.pdf`,
      storage_path: storagePath,
      file_size: body.fileSize || 0,
      mime_type: body.mimeType || 'application/pdf',
      uploaded_by: uploadedBy,
    }).select().single();
    if (error) throw new Error(error.message);
    return { success: true, document: data };
  }
  if (p.match(/^\/documents\/\d+\/download$/) && method === 'GET') {
    const id = parseInt(p.split('/')[2]);
    const { data: doc } = await supabase.from('documents').select('storage_path, original_name').eq('id', id).single();
    if (doc?.storage_path) {
      const { data } = await supabase.storage.from('documents').download(doc.storage_path);
      return data;
    }
    return new Response('Demo file content', {
      headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${doc?.original_name || 'file.pdf'}"` }
    });
  }
  if (p.match(/^\/documents\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    // Delete storage file if exists
    const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', id).single();
    if (doc?.storage_path) {
      await supabase.storage.from('documents').remove([doc.storage_path]);
    }
    await supabase.from('documents').delete().eq('id', id);
    return { success: true };
  }

  // ── REQUIREMENTS ──
  if (p === '/requirements' && method === 'GET') {
    let q = supabase.from('requirements').select('*');
    if (query.status) q = q.eq('status', query.status);
    const { data } = await q;
    return { requirements: data || [] };
  }
  if (p === '/requirements' && method === 'POST') {
    const { data } = await supabase.from('requirements').insert({
      title: body.title,
      description: body.description,
      project: body.project,
      location_type: body.locationType,
      location_detail: body.locationDetail,
      positions_count: body.positionsCount || 1,
      skills: body.skills,
      priority: body.priority || 'medium',
      status: 'open',
      created_by: body.createdBy || 'ADM001',
      requested_by: body.requestedBy || null,
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/requirements\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('requirements')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/requirements\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('requirements').delete().eq('id', id);
    return { success: true };
  }

  // ── REFERRALS ──
  if (p === '/referrals' && method === 'GET') {
    let q = supabase.from('referrals').select('*').order('created_at', { ascending: false });
    if (query.userId) q = q.eq('referred_by', query.userId);
    const { data } = await q;
    return { referrals: data || [] };
  }
  if (p === '/referrals' && method === 'POST') {
    const { data, error } = await supabase.from('referrals').insert({
      requirement_id: body.requirementId ? parseInt(body.requirementId) : null,
      candidate_name: body.candidateName,
      candidate_email: body.candidateEmail || null,
      candidate_phone: body.candidatePhone || null,
      referred_by: body.referredBy,
      referred_by_name: body.referredByName || null,
      notes: body.notes || null,
      status: 'submitted',
    }).select().single();
    if (error) throw new Error(error.message);
    // Return id at top level (and the row) so callers can attach a resume file.
    return { success: true, id: data.id, referral: data };
  }
  if (p.match(/^\/referrals\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('referrals').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id);
    return { success: true };
  }

  // ── LEAVES ──
  if (p === '/leaves' && method === 'GET') {
    let q = supabase.from('leaves').select('*');
    if (query.userId) q = q.eq('user_id', query.userId);
    if (query.status) q = q.eq('status', query.status);
    if (query.from) q = q.gte('start_date', query.from);
    if (query.to) q = q.lte('start_date', query.to);
    if (query.project) {
      // Filter by user project: get user IDs in this project first
      const { data: projUsers } = await supabase.from('users').select('id').eq('project', query.project);
      if (projUsers) q = q.in('user_id', projUsers.map(u => u.id));
    }
    q = q.order('created_at', { ascending: false });
    const { data } = await q;
    return { leaves: data || [] };
  }
  if (p.match(/^\/leaves\/balances\/[^/]+$/) && method === 'GET') {
    const userId = p.split('/')[3];
    const { data } = await supabase.from('leave_balances').select('*').eq('user_id', userId);
    return { balances: data || [] };
  }
  if (p === '/leaves' && method === 'POST') {
    const { data: userData } = await supabase.from('users').select('name').eq('id', body.userId).single();
    const { data } = await supabase.from('leaves').insert({
      user_id: body.userId,
      user_name: userData?.name || '',
      leave_type: body.leaveType,
      start_date: body.startDate,
      end_date: body.endDate,
      days_count: body.daysCount,
      reason: body.reason,
      status: body.status || 'pending',
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/leaves\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('leaves')
      .update({
        status: body.status,
        approved_by: body.approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);
    // Update balance if approved
    if (body.status === 'approved') {
      const { data: leave } = await supabase.from('leaves').select('*').eq('id', id).single();
      if (leave) {
        const { data: bal } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('user_id', leave.user_id)
          .eq('leave_type', leave.leave_type)
          .single();
        if (bal) {
          await supabase
            .from('leave_balances')
            .update({ used_days: bal.used_days + leave.days_count })
            .eq('id', bal.id);
        }
      }
    }
    return { success: true };
  }
  if (p.match(/^\/leaves\/\d+$/) && method === 'PATCH') {
    const id = parseInt(p.split('/')[2]);
    const updates = {};
    if (body.leaveType !== undefined) updates.leave_type = body.leaveType;
    if (body.startDate !== undefined) updates.start_date = body.startDate;
    if (body.endDate !== undefined) updates.end_date = body.endDate;
    if (body.daysCount !== undefined) updates.days_count = body.daysCount;
    if (body.reason !== undefined) updates.reason = body.reason;
    if (body.status !== undefined) updates.status = body.status;
    if (body.userId !== undefined) {
      updates.user_id = body.userId;
      const { data: userData } = await supabase.from('users').select('name').eq('id', body.userId).single();
      updates.user_name = userData?.name || '';
    }
    const { error } = await supabase.from('leaves').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (p.match(/^\/leaves\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    const { error } = await supabase.from('leaves').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── TASKS ──
  if (p === '/tasks' && method === 'GET') {
    let q = supabase.from('tasks').select('*');
    if (query.userId) q = q.eq('user_id', query.userId);
    if (query.date) q = q.eq('date', query.date);
    if (query.status) q = q.eq('status', query.status);
    if (query.assignedBy) q = q.eq('assigned_by', query.assignedBy);
    const { data } = await q;
    return { tasks: data || [] };
  }
  if (p.match(/^\/tasks\/kpi\/[^/]+$/) && method === 'GET') {
    const userId = p.split('/')[3];
    let q = supabase.from('tasks').select('*').eq('user_id', userId);
    if (query.period) q = q.like('date', `${query.period}%`);
    const { data: allTasks } = await q;
    const t = allTasks || [];
    const completed = t.filter(x => x.status === 'completed');
    const avgHours = completed.length > 0
      ? completed.reduce((s, x) => s + (x.actual_hours || x.estimated_hours || 0), 0) / completed.length
      : 0;
    return {
      tasks_assigned: t.length,
      tasks_completed: completed.length,
      avg_hours: avgHours,
      employees: [{ user_id: userId, assigned: t.length, completed: completed.length }],
    };
  }
  if (p === '/tasks' && method === 'POST') {
    const { data: userData } = await supabase.from('users').select('name').eq('id', body.userId).single();
    const { data: assignerData } = await supabase.from('users').select('name').eq('id', body.assignedBy).single();
    const { data } = await supabase.from('tasks').insert({
      user_id: body.userId,
      user_name: userData?.name || '',
      assigned_by: body.assignedBy,
      assigned_by_name: assignerData?.name || '',
      title: body.title,
      description: body.description,
      date: body.date,
      priority: body.priority || 'medium',
      status: 'pending',
      estimated_hours: body.estimatedHours,
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/tasks\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const updates = { ...body, updated_at: new Date().toISOString() };
    if (body.status === 'completed') updates.completed_at = new Date().toISOString();
    await supabase.from('tasks').update(updates).eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/tasks\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('tasks').delete().eq('id', id);
    return { success: true };
  }

  // ── MEETINGS ──
  if (p === '/meetings' && method === 'GET') {
    let q = supabase.from('meetings').select('*');
    if (query.project) q = q.eq('project', query.project);
    if (query.month) q = q.gte('date', `${query.month}-01`).lte('date', `${query.month}-31`);
    const { data } = await q;
    // Serialize attendees to match mock format (stringify JSONB)
    const meetings = (data || []).map(m => ({
      ...m,
      attendees: typeof m.attendees === 'string' ? m.attendees : JSON.stringify(m.attendees),
    }));
    return { meetings };
  }
  if (p === '/meetings' && method === 'POST') {
    const { data: creatorData } = await supabase.from('users').select('name').eq('id', body.createdBy || 'ADM001').single();
    const attendees = typeof body.attendees === 'string' ? JSON.parse(body.attendees) : body.attendees;
    const { data } = await supabase.from('meetings').insert({
      title: body.title,
      date: body.date,
      time: body.time,
      attendees,
      notes: body.notes,
      project: body.project,
      created_by: body.createdBy || 'ADM001',
      created_by_name: creatorData?.name || '',
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/meetings\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const updates = { ...body, updated_at: new Date().toISOString() };
    if (updates.attendees && typeof updates.attendees === 'string') {
      updates.attendees = JSON.parse(updates.attendees);
    }
    await supabase.from('meetings').update(updates).eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/meetings\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('meetings').delete().eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/meetings\/\d+\/actions$/) && method === 'GET') {
    const meetingId = parseInt(p.split('/')[2]);
    const { data } = await supabase.from('meeting_actions').select('*').eq('meeting_id', meetingId);
    return { actions: data || [] };
  }
  if (p.match(/^\/meetings\/\d+\/actions$/) && method === 'POST') {
    const meetingId = parseInt(p.split('/')[2]);
    const { data: assigneeData } = body.assignedTo
      ? await supabase.from('users').select('name').eq('id', body.assignedTo).single()
      : { data: null };
    const { data } = await supabase.from('meeting_actions').insert({
      meeting_id: meetingId,
      description: body.description,
      assigned_to: body.assignedTo || null,
      assigned_to_name: assigneeData?.name || '',
      due_date: body.dueDate || null,
      status: 'open',
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/meetings\/actions\/\d+$/) && method === 'PUT') {
    const actionId = parseInt(p.split('/')[3]);
    const updates = {};
    if (body.status) {
      updates.status = body.status;
      updates.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
    }
    if (body.description !== undefined) updates.description = body.description;
    await supabase.from('meeting_actions').update(updates).eq('id', actionId);
    return { success: true };
  }

  // ── SALES ──
  if (p === '/sales' && method === 'GET') {
    let q = supabase.from('sales_deals').select('*');
    if (query.stage) q = q.eq('stage', query.stage);
    if (query.ownerId) q = q.eq('owner_id', query.ownerId);
    const { data } = await q;
    return { deals: data || [] };
  }
  if (p === '/sales' && method === 'POST') {
    const { data } = await supabase.from('sales_deals').insert({
      title: body.title,
      client_name: body.clientName,
      deal_value: body.dealValue || 0,
      currency: body.currency || 'USD',
      stage: body.stage || 'prospect',
      probability: body.probability || 0,
      expected_close_date: body.expectedCloseDate,
      owner_id: body.ownerId,
      notes: body.notes,
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/sales\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const updates = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.clientName !== undefined) updates.client_name = body.clientName;
    if (body.dealValue !== undefined) updates.deal_value = body.dealValue;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.stage !== undefined) updates.stage = body.stage;
    if (body.probability !== undefined) updates.probability = body.probability;
    if (body.expectedCloseDate !== undefined) updates.expected_close_date = body.expectedCloseDate;
    if (body.notes !== undefined) updates.notes = body.notes;
    updates.updated_at = new Date().toISOString();
    await supabase.from('sales_deals').update(updates).eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/sales\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('sales_deals').delete().eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/sales\/\d+\/activities$/) && method === 'GET') {
    const dealId = parseInt(p.split('/')[2]);
    const { data } = await supabase.from('sales_activities').select('*').eq('deal_id', dealId);
    return { activities: data || [] };
  }
  if (p.match(/^\/sales\/\d+\/activities$/) && method === 'POST') {
    const dealId = parseInt(p.split('/')[2]);
    await supabase.from('sales_activities').insert({
      deal_id: dealId,
      activity_type: body.activityType,
      description: body.description,
      created_by: body.createdBy,
    });
    return { success: true };
  }

  // ── NINEBOX ──
  if (p === '/ninebox' && method === 'GET') {
    let q = supabase.from('ninebox_placements').select('*');
    if (query.period) q = q.eq('period', query.period);
    const { data } = await q;
    // Enrich with current hourly_rate from users table
    const userIds = [...new Set((data || []).map(p => p.user_id))];
    let rateMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, hourly_rate').in('id', userIds);
      rateMap = Object.fromEntries((users || []).map(u => [u.id, u.hourly_rate]));
    }
    const placements = (data || []).map(p => ({ ...p, hourly_rate: rateMap[p.user_id] ?? p.hourly_rate ?? 0 }));
    return { placements };
  }
  if (p === '/ninebox' && method === 'POST') {
    const { data: userData } = await supabase.from('users').select('name, hourly_rate, project').eq('id', body.userId).single();
    // Upsert
    const { data: existing } = await supabase
      .from('ninebox_placements')
      .select('id')
      .eq('user_id', body.userId)
      .eq('period', body.period)
      .maybeSingle();

    const rate = body.hourlyRate || userData?.hourly_rate || 0;
    if (existing) {
      await supabase.from('ninebox_placements').update({
        potential: body.potential,
        performance: body.performance,
        hourly_rate: rate,
        notes: body.notes,
        placed_by: body.placedBy || 'ADM001',
        placed_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('ninebox_placements').insert({
        user_id: body.userId,
        user_name: userData?.name || '',
        hourly_rate: rate,
        project: userData?.project,
        potential: body.potential,
        performance: body.performance,
        period: body.period,
        notes: body.notes,
        placed_by: body.placedBy || 'ADM001',
      });
    }
    // Also update user's hourly_rate if provided
    if (body.hourlyRate) {
      await supabase.from('users').update({ hourly_rate: body.hourlyRate }).eq('id', body.userId);
    }
    return { success: true };
  }
  if (p.match(/^\/ninebox\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('ninebox_placements').update(body).eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/ninebox\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('ninebox_placements').delete().eq('id', id);
    return { success: true };
  }

  // ── REPORTS ──
  if (p === '/reports/timesheet-summary') {
    const { data, error } = await supabase.rpc('get_timesheet_summary', { p_period: query.period || null });
    return { summary: data || [] };
  }
  if (p === '/reports/leave-summary') {
    const { data } = await supabase.rpc('get_leave_summary');
    return data || { by_type: [], by_employee: [] };
  }
  if (p === '/reports/task-summary') {
    const { data: allTasks } = await supabase.from('tasks').select('user_id, user_name, status');
    const byUser = {};
    for (const t of (allTasks || [])) {
      if (!byUser[t.user_id]) byUser[t.user_id] = { user_id: t.user_id, user_name: t.user_name, assigned: 0, completed: 0, blocked: 0 };
      byUser[t.user_id].assigned++;
      if (t.status === 'completed') byUser[t.user_id].completed++;
      if (t.status === 'blocked') byUser[t.user_id].blocked++;
    }
    return { employees: Object.values(byUser).sort((a, b) => b.completed - a.completed) };
  }
  if (p === '/reports/sales-pipeline') {
    const stageOrder = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const { data: deals } = await supabase.from('sales_deals').select('stage, deal_value');
    const byStage = {};
    for (const d of (deals || [])) {
      if (!byStage[d.stage]) byStage[d.stage] = { stage: d.stage, count: 0, total_value: 0 };
      byStage[d.stage].count++;
      byStage[d.stage].total_value += Number(d.deal_value);
    }
    return { stages: stageOrder.filter(s => byStage[s]).map(s => byStage[s]) };
  }

  // ── SOW RESOURCES ──
  if (p === '/sow-resources' && method === 'GET') {
    const { data } = await supabase.from('sow_resources').select('*').order('name');
    return { resources: data || [] };
  }
  if (p === '/sow-resources' && method === 'POST') {
    const { data } = await supabase.from('sow_resources').insert(body).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/sow-resources\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('sow_resources')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/sow-resources\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('sow_resources').delete().eq('id', id);
    return { success: true };
  }

  // ── AI MEETING NOTES ──
  if (p === '/meeting-notes' && method === 'GET') {
    let q = supabase.from('meeting_notes_ai').select('*').order('meeting_date', { ascending: false });
    if (query.status) q = q.eq('status', query.status);
    if (query.limit) q = q.limit(parseInt(query.limit));
    const { data } = await q;
    return { notes: data || [] };
  }
  if (p === '/meeting-notes' && method === 'POST') {
    const { data } = await supabase.from('meeting_notes_ai').insert({
      title: body.title,
      meeting_date: body.meetingDate,
      meeting_end: body.meetingEnd || null,
      organizer: body.organizer || null,
      attendees: body.attendees ? JSON.stringify(body.attendees) : '[]',
      transcript_text: body.transcript || null,
      transcript_source: body.transcript ? 'manual' : 'pending',
      status: body.transcript ? 'transcript_ready' : 'pending',
    }).select('id').single();
    return { id: data?.id };
  }
  if (p.match(/^\/meeting-notes\/\d+$/) && method === 'GET') {
    const id = parseInt(p.split('/')[2]);
    const { data } = await supabase.from('meeting_notes_ai').select('*').eq('id', id).single();
    return { note: data };
  }
  if (p.match(/^\/meeting-notes\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const updates = {};
    if (body.transcript !== undefined) {
      updates.transcript_text = body.transcript;
      updates.transcript_source = 'manual';
      updates.status = 'transcript_ready';
    }
    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;
    updates.updated_at = new Date().toISOString();
    await supabase.from('meeting_notes_ai').update(updates).eq('id', id);
    return { success: true };
  }
  if (p.match(/^\/meeting-notes\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    await supabase.from('meeting_notes_ai').delete().eq('id', id);
    return { success: true };
  }
  // Action items for AI meeting notes
  if (p.match(/^\/meeting-notes\/\d+\/actions$/) && method === 'GET') {
    const noteId = parseInt(p.split('/')[2]);
    const { data } = await supabase.from('meeting_action_items').select('*').eq('meeting_note_id', noteId).order('created_at');
    return { actions: data || [] };
  }
  if (p.match(/^\/meeting-notes\/actions\/\d+$/) && method === 'PUT') {
    const actionId = parseInt(p.split('/')[3]);
    const updates = {};
    if (body.status) {
      updates.status = body.status;
      updates.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
    }
    await supabase.from('meeting_action_items').update(updates).eq('id', actionId);
    return { success: true };
  }
  // All open action items across meetings (for dashboard)
  if (p === '/meeting-notes/all-actions' && method === 'GET') {
    let q = supabase.from('meeting_action_items').select('*, meeting_notes_ai(title, meeting_date)');
    if (query.status) q = q.eq('status', query.status);
    if (query.assignee) q = q.eq('assignee_user_id', query.assignee);
    const { data } = await q.order('created_at', { ascending: false });
    return { actions: data || [] };
  }

  // ── CLIENTS ──
  if (p === '/clients' && method === 'GET') {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) throw new Error(error.message);
    return { clients: data || [] };
  }
  if (p === '/clients' && method === 'POST') {
    const { data, error } = await supabase.from('clients').insert({
      id: body.id, name: body.name, region: body.region, contact_name: body.contact_name,
      contact_email: body.contact_email, status: body.status || 'active', notes: body.notes,
    }).select().single();
    if (error) throw new Error(error.message);
    return { client: data };
  }
  if (p.match(/^\/clients\/[^/]+$/) && method === 'PUT') {
    const id = p.split('/')[2];
    const { data, error } = await supabase.from('clients').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { client: data };
  }
  if (p.match(/^\/clients\/[^/]+$/) && method === 'DELETE') {
    const id = p.split('/')[2];
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── BILLABLE PROJECTS ──
  if (p === '/billable-projects' && method === 'GET') {
    let q = supabase.from('billable_projects').select('*').order('name');
    if (query.client_id) q = q.eq('client_id', query.client_id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { projects: data || [] };
  }
  if (p === '/billable-projects' && method === 'POST') {
    const { data, error } = await supabase.from('billable_projects').insert({
      id: body.id, name: body.name, client_id: body.client_id || null,
      billing_type: body.billing_type || 'hourly', bill_rate: body.bill_rate || 0,
      currency: body.currency || 'USD', status: body.status || 'active', notes: body.notes,
    }).select().single();
    if (error) throw new Error(error.message);
    return { project: data };
  }
  if (p.match(/^\/billable-projects\/[^/]+$/) && method === 'PUT') {
    const id = p.split('/')[2];
    const { data, error } = await supabase.from('billable_projects').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { project: data };
  }
  if (p.match(/^\/billable-projects\/[^/]+$/) && method === 'DELETE') {
    const id = p.split('/')[2];
    const { error } = await supabase.from('billable_projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── INVOICES ──
  if (p === '/invoices' && method === 'GET') {
    let q = supabase.from('invoices').select('*, lines:invoice_lines(*)').order('issue_date', { ascending: false });
    if (query.client_id) q = q.eq('client_id', query.client_id);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { invoices: data || [] };
  }
  if (p.match(/^\/invoices\/\d+$/) && method === 'GET') {
    const id = parseInt(p.split('/')[2]);
    const { data, error } = await supabase.from('invoices').select('*, lines:invoice_lines(*)').eq('id', id).single();
    if (error) throw new Error(error.message);
    return { invoice: data };
  }
  if (p === '/invoices' && method === 'POST') {
    const lines = body.lines || [];
    const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || (Number(l.hours || 0) * Number(l.rate || 0))), 0);
    const insertData = {
      invoice_number: body.invoice_number, client_id: body.client_id,
      period_start: body.period_start, period_end: body.period_end,
      issue_date: body.issue_date, due_date: body.due_date,
      currency: body.currency || 'USD', subtotal: body.total_amount || subtotal, total_amount: body.total_amount || subtotal,
      status: body.status || 'draft', notes: body.notes, created_by: body.created_by,
    };
    if (body.file_url !== undefined) insertData.file_url = body.file_url;
    if (body.file_name !== undefined) insertData.file_name = body.file_name;
    const { data: inv, error } = await supabase.from('invoices').insert(insertData).select().single();
    if (error) throw new Error(error.message);
    if (lines.length > 0) {
      const lineRows = lines.map(l => ({
        invoice_id: inv.id, project_id: l.project_id || null, project_name: l.project_name,
        description: l.description, hours: l.hours, rate: l.rate,
        amount: Number(l.amount) || (Number(l.hours || 0) * Number(l.rate || 0)),
      }));
      await supabase.from('invoice_lines').insert(lineRows);
    }
    return { invoice: inv };
  }
  if (p.match(/^\/invoices\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const updates = { ...body };
    if (updates.lines) delete updates.lines;
    if (body.status === 'paid' && !body.paid_at) updates.paid_at = new Date().toISOString();
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    if (Array.isArray(body.lines)) {
      await supabase.from('invoice_lines').delete().eq('invoice_id', id);
      const lineRows = body.lines.map(l => ({
        invoice_id: id, project_id: l.project_id || null, project_name: l.project_name,
        description: l.description, hours: l.hours, rate: l.rate,
        amount: Number(l.amount) || (Number(l.hours || 0) * Number(l.rate || 0)),
      }));
      if (lineRows.length > 0) await supabase.from('invoice_lines').insert(lineRows);
    }
    return { invoice: data };
  }
  if (p.match(/^\/invoices\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── FINANCE SUMMARY (compute client-side from timesheets + billable rates) ──
  if (p === '/finance/summary' && method === 'GET') {
    // Revenue = SOW billing rate × hours; Payout = salary-derived hourly cost × hours
    // Overhead factor: 17% of revenue goes to insurance, vendor costs, etc.
    const OVERHEAD_PCT = 0.17;
    const [{ data: tsData }, { data: usersData }, { data: salaryData }] = await Promise.all([
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').in('status', ['submitted', 'saved']),
      supabase.from('users').select('id, name, hourly_rate, project'),
      supabase.from('employee_salaries').select('id, ctc_amount, ctc_currency, ctc_period'),
    ]);
    const from = query.from || null;
    const to = query.to || null;
    const rateByEmp = Object.fromEntries((usersData || []).map(u => [u.id, u.hourly_rate || 0]));
    const empName = Object.fromEntries((usersData || []).map(u => [u.id, u.name]));
    const empProject = Object.fromEntries((usersData || []).map(u => [u.id, u.project]));

    // Hourly cost = annual CTC (USD) / 2080. Prefer DB salaries; fall back to
    // the static file only for IDs the DB doesn't cover.
    const FX = { INR: 1 / 83, USD: 1, AED: 1 / 3.67 };
    const HOURS_PER_YEAR = 2080;
    const toHourly = (s) => {
      if (s == null || s.ctc_amount == null || !s.ctc_currency) return null;
      const fx = FX[s.ctc_currency] || 1;
      let annualUsd = Number(s.ctc_amount) * fx;
      if (s.ctc_period === 'hourly') annualUsd *= HOURS_PER_YEAR;
      else if (s.ctc_period === 'monthly') annualUsd *= 12;
      return annualUsd / HOURS_PER_YEAR;
    };
    const costByEmp = {};
    for (const s of EMPLOYEE_SALARIES) {
      const h = toHourly(s);
      if (h != null) costByEmp[s.id] = h;
    }
    for (const s of (salaryData || [])) {
      const h = toHourly(s);
      if (h != null) costByEmp[s.id] = h; // DB wins over static file
    }

    const inRange = (d) => (!from || d >= from) && (!to || d <= to);
    let totalHours = 0, totalRevenue = 0, totalPayout = 0;
    const byProject = {}, byDay = {}, byEmployee = {}, byProjectDay = {};

    for (const ts of (tsData || [])) {
      const sowRate = rateByEmp[ts.user_id] || 0;
      const hourlyCost = costByEmp[ts.user_id] || 0;
      const proj = empProject[ts.user_id] || 'Unassigned';
      for (const e of (ts.entries || [])) {
        if (!e.hours || !inRange(e.date)) continue;
        const revenue = e.hours * sowRate;
        const overhead = revenue * OVERHEAD_PCT;
        const payout = e.hours * hourlyCost + overhead;
        totalHours += e.hours; totalRevenue += revenue; totalPayout += payout;

        if (!byProject[proj]) byProject[proj] = { project: proj, hours: 0, revenue: 0, payout: 0, rate: 0 };
        byProject[proj].hours += e.hours; byProject[proj].revenue += revenue; byProject[proj].payout += payout;

        if (!byDay[e.date]) byDay[e.date] = { date: e.date, hours: 0, revenue: 0, payout: 0 };
        byDay[e.date].hours += e.hours; byDay[e.date].revenue += revenue; byDay[e.date].payout += payout;

        if (!byProjectDay[proj]) byProjectDay[proj] = {};
        if (!byProjectDay[proj][e.date]) byProjectDay[proj][e.date] = { date: e.date, hours: 0, revenue: 0, payout: 0 };
        byProjectDay[proj][e.date].hours += e.hours;
        byProjectDay[proj][e.date].revenue += revenue;
        byProjectDay[proj][e.date].payout += payout;

        if (!byEmployee[ts.user_id]) byEmployee[ts.user_id] = { user_id: ts.user_id, user_name: empName[ts.user_id] || ts.user_name, project: proj, hours: 0, revenue: 0, payout: 0, rate: sowRate, cost_rate: hourlyCost };
        byEmployee[ts.user_id].hours += e.hours; byEmployee[ts.user_id].revenue += revenue; byEmployee[ts.user_id].payout += payout;
      }
    }
    // Compute average rate per project from employee rates
    for (const proj of Object.values(byProject)) {
      if (proj.hours > 0) proj.rate = Math.round(proj.revenue / proj.hours);
    }
    const byProjectDaySeries = Object.fromEntries(
      Object.entries(byProjectDay).map(([proj, days]) => [proj, Object.values(days).sort((a, b) => a.date.localeCompare(b.date))])
    );
    const margin = totalRevenue - totalPayout;
    const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
    return {
      totals: {
        hours: totalHours, revenue: totalRevenue, payout: Math.round(totalPayout),
        margin: Math.round(margin),
        margin_pct: Math.round(marginPct * 10) / 10,
      },
      by_project: Object.values(byProject).sort((a, b) => b.revenue - a.revenue),
      by_client: [{ client_id: 'CLT001', client_name: 'Visual Comfort Company', hours: totalHours, revenue: totalRevenue, payout: Math.round(totalPayout) }],
      by_day: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      by_employee: Object.values(byEmployee).sort((a, b) => b.revenue - a.revenue),
      by_project_day: byProjectDaySeries,
    };
  }

  // ── HOLIDAYS ──
  if (p === '/holidays' && method === 'GET') {
    let q = supabase.from('holidays').select('*').order('holiday_date');
    if (query.country) q = q.eq('country', query.country);
    if (query.from) q = q.gte('holiday_date', query.from);
    if (query.to) q = q.lte('holiday_date', query.to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { holidays: data || [] };
  }

  // ── LEAVE IMPACT ──
  if (p === '/finance/leave-impact' && method === 'GET') {
    const from = query.from, to = query.to;
    const [{ data: leaves }, { data: usersData }, { data: holidayData }] = await Promise.all([
      supabase.from('leaves').select('*').in('status', ['approved', 'pending']),
      supabase.from('users').select('id, name, project, hourly_rate'),
      supabase.from('holidays').select('holiday_date, country'),
    ]);
    const userIndex = Object.fromEntries((usersData || []).map(u => [u.id, u]));
    const holidaySet = new Set((holidayData || []).map(h => `${h.holiday_date}|${h.country}`));
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);

    let approvedLost = 0, pendingLost = 0, totalDays = 0;
    const items = [];
    for (const lv of (leaves || [])) {
      if (!inRange(lv.start_date)) continue;
      const u = userIndex[lv.user_id];
      if (!u) continue;
      const rate = u.hourly_rate || 0;
      const country = (lv.user_id.startsWith('D4US') || lv.user_id.startsWith('CON')) ? 'US' : 'IN';
      let billableDays = 0;
      const start = new Date(lv.start_date), end = new Date(lv.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        if (holidaySet.has(`${iso}|${country}`) || holidaySet.has(`${iso}|GLOBAL`)) continue;
        billableDays++;
      }
      const lost = billableDays * 8 * rate;
      items.push({
        leave_id: lv.id, user_id: lv.user_id, user_name: u.name, project: u.project,
        leave_type: lv.leave_type, start_date: lv.start_date, end_date: lv.end_date,
        billable_days: billableDays, rate, revenue_lost: lost, status: lv.status,
      });
      totalDays += billableDays;
      if (lv.status === 'approved') approvedLost += lost; else pendingLost += lost;
    }
    return { totals: { approved_lost: approvedLost, pending_lost: pendingLost, total_days: totalDays }, items: items.sort((a, b) => b.revenue_lost - a.revenue_lost) };
  }

  if (p === '/finance/billable-hours' && method === 'GET') {
    const from = query.from, to = query.to;
    if (!from || !to) throw new Error('from and to required');
    const [{ data: tsData }, { data: usersData }] = await Promise.all([
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').in('status', ['submitted', 'saved']),
      supabase.from('users').select('id, hourly_rate'),
    ]);
    const rateByEmp = Object.fromEntries((usersData || []).map(u => [u.id, u.hourly_rate || 0]));
    const byProject = {};
    for (const ts of (tsData || [])) {
      const sowRate = rateByEmp[ts.user_id] || 0;
      for (const e of (ts.entries || [])) {
        if (!e.hours || !e.work_item) continue;
        if (e.date < from || e.date > to) continue;
        if (!byProject[e.work_item]) byProject[e.work_item] = { project_id: e.work_item, project_name: e.work_item, hours: 0, rate: 0, currency: 'USD', amount: 0 };
        byProject[e.work_item].hours += e.hours;
        byProject[e.work_item].amount += e.hours * sowRate;
      }
    }
    // Compute effective rate per project
    for (const proj of Object.values(byProject)) {
      if (proj.hours > 0) proj.rate = Math.round(proj.amount / proj.hours);
    }
    return { lines: Object.values(byProject) };
  }

  // ── SOWs ──
  if (p === '/sows' && method === 'GET') {
    let q = supabase.from('sows').select('*').order('created_at', { ascending: false });
    if (query.client_id) q = q.eq('client_id', query.client_id);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // Attach vendor_name when the SOW references a billable_project tied to a vendor.
    const projectIds = [...new Set((data || []).map(s => s.project_id).filter(Boolean))];
    let vendorByProjectId = {};
    if (projectIds.length) {
      const { data: bpRows } = await supabase.from('billable_projects').select('id, vendor_id').in('id', projectIds);
      const vendorIds = [...new Set((bpRows || []).map(b => b.vendor_id).filter(Boolean))];
      let vendorNameById = {};
      if (vendorIds.length) {
        const { data: vRows } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
        vendorNameById = Object.fromEntries((vRows || []).map(v => [v.id, v.name]));
      }
      vendorByProjectId = Object.fromEntries((bpRows || []).map(b => [b.id, vendorNameById[b.vendor_id] || null]));
    }
    const enriched = (data || []).map(s => ({ ...s, vendor_name: vendorByProjectId[s.project_id] || null }));
    return { sows: enriched };
  }
  if (p.match(/^\/sows\/\d+$/) && method === 'GET') {
    const id = parseInt(p.split('/')[2]);
    const { data, error } = await supabase.from('sows').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return { sow: data };
  }
  if (p === '/sows' && method === 'POST') {
    const sowNumber = body.sow_number || `SOW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const insertData = {
      sow_number: sowNumber, client_id: body.client_id, project_id: body.project_id || null,
      title: body.title, sow_type: body.sow_type || 'project', description: body.description,
      contract_value: body.contract_value || 0, currency: body.currency || 'USD',
      start_date: body.start_date, end_date: body.end_date, status: body.status || 'draft',
      resource_name: body.resource_name, resource_role: body.resource_role, resource_rate: body.resource_rate,
      created_by: body.created_by,
    };
    if (body.file_url) insertData.file_url = body.file_url;
    if (body.file_name) insertData.file_name = body.file_name;
    const { data, error } = await supabase.from('sows').insert(insertData).select().single();
    if (error) throw new Error(error.message);
    return { sow: data };
  }
  if (p.match(/^\/sows\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const { data, error } = await supabase.from('sows').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { sow: data };
  }
  if (p.match(/^\/sows\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    const { error } = await supabase.from('sows').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  // Attach an uploaded document to the SOW with a given sow_number. If no SOW
  // exists with that number, auto-create a draft one so the file shows up in
  // SOW Manager / SOW Workflow immediately (used from User Management).
  if (p === '/sows/attach-file' && method === 'POST') {
    const sowNumber = (body.sow_number || '').trim();
    if (!sowNumber) throw new Error('SOW number is required to map the document');
    const { data: existing, error: findErr } = await supabase.from('sows').select('id').eq('sow_number', sowNumber).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing) {
      const { data, error } = await supabase.from('sows')
        .update({ file_url: body.file_url || null, file_name: body.file_name || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id).select().single();
      if (error) throw new Error(error.message);
      return { sow: data, attached: true, created: false };
    }
    // Auto-create a draft SOW with the uploaded file.
    const clientId = body.client_id || 'CLT001';
    const insertData = {
      sow_number: sowNumber,
      client_id: clientId,
      title: body.title || `SOW ${sowNumber}`,
      sow_type: body.sow_type || 'resource',
      resource_name: body.resource_name || null,
      resource_role: body.resource_role || null,
      resource_rate: body.resource_rate != null ? Number(body.resource_rate) : null,
      currency: body.currency || 'USD',
      status: 'draft',
      file_url: body.file_url || null,
      file_name: body.file_name || null,
    };
    const { data, error } = await supabase.from('sows').insert(insertData).select().single();
    if (error) throw new Error(error.message);
    return { sow: data, attached: true, created: true };
  }
  // SOW submit to finance — send approval email via Graph API on VPS
  if (p.match(/^\/sows\/\d+\/submit-email$/) && method === 'POST') {
    const id = parseInt(p.split('/')[2]);
    // Update SOW status to submitted_for_finance
    const { data, error } = await supabase.from('sows').update({
      status: 'submitted_for_finance',
      finance_notes: body.custom_to ? `Sent to: ${body.custom_to}` : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);

    // SAFETY: Only allow internal @d4insight.com recipients
    const toAddr = (body.custom_to || '').trim().toLowerCase();
    if (toAddr && !toAddr.endsWith('@d4insight.com')) {
      throw new Error('Only @d4insight.com email addresses are allowed. Cannot send to external/client emails.');
    }

    // Store email job for VPS to pick up
    try {
      await supabase.from('email_queue').insert({
        sow_id: id,
        to_email: body.custom_to,
        subject: body.custom_subject,
        body_text: body.custom_body,
        body_html: body.sow_html || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    } catch (queueErr) {
      // email_queue table may not exist yet — still update SOW status
      console.warn('Email queue insert failed (table may not exist):', queueErr.message);
    }
    return { sow: data, message: 'SOW submitted for approval. Email will be sent shortly.' };
  }

  // SOW check-approval — reads latest status from Supabase
  // (sow_agent on VPS updates status when approval replies arrive via email)
  if (p.match(/^\/sows\/\d+\/check-approval$/) && method === 'POST') {
    const id = parseInt(p.split('/')[2]);
    const { data, error } = await supabase.from('sows').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    const s = data;
    let message = 'No response yet. The VPS agent will update status when an email reply is received.';
    if (s.status === 'finance_approved') message = `Approved by ${s.finance_approved_by || 'finance'}`;
    else if (s.status === 'rejected') message = `Rejected: ${s.rejection_reason || 'No reason given'}`;
    else if (s.status === 'changes_requested') message = `Changes requested. ${s.approval_notes || ''}`;
    return { status: s.status, notes: s.approval_notes || '', reason: s.rejection_reason || '', message };
  }

  if (p.match(/^\/sows\/\d+\/(finance-approve|send-for-signature|sign|activate|reject)$/) && method === 'POST') {
    const id = parseInt(p.split('/')[2]);
    const action = p.split('/')[3];
    const updates = { updated_at: new Date().toISOString() };
    if (action === 'finance-approve') {
      updates.status = 'finance_approved';
      updates.finance_approved_by = body?.user_id;
      updates.finance_approved_at = new Date().toISOString();
      if (body?.notes) updates.finance_notes = body.notes;
    }
    if (action === 'send-for-signature') {
      updates.status = 'sent_for_signature';
      updates.docusign_envelope_id = body?.envelope_id || `DEMO-DS-${Math.floor(Math.random() * 9000 + 1000)}`;
      updates.docusign_status = 'sent';
    }
    if (action === 'sign') {
      updates.status = 'signed';
      updates.manager_signed_by = body?.user_id;
      updates.manager_signed_at = new Date().toISOString();
      updates.docusign_status = 'completed';
    }
    if (action === 'activate') updates.status = 'active';
    if (action === 'reject') {
      updates.status = 'rejected';
      updates.rejected_by = body?.user_id;
      updates.rejected_at = new Date().toISOString();
      updates.rejection_reason = body?.reason || null;
    }
    const { data, error } = await supabase.from('sows').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { sow: data };
  }

  // ── CLIENT TIMESHEETS / INVOICES ──
  if (p === '/client/timesheets' && method === 'GET') {
    // Caller already gated to client at the UI layer; RLS filters to their client_id.
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    const myClientId = meRow?.client_id;

    const [{ data: tsData }, { data: bpList }, { data: usersData }, { data: vendorList }] = await Promise.all([
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').eq('status', 'submitted'),
      myClientId ? supabase.from('billable_projects').select('id, name, vendor_id').eq('client_id', myClientId) : Promise.resolve({ data: [] }),
      supabase.from('users').select('id, vendor_id'),
      myClientId ? supabase.from('vendors').select('id, name').eq('client_id', myClientId) : Promise.resolve({ data: [] }),
    ]);

    const vendorById = Object.fromEntries((vendorList || []).map(v => [v.id, v]));
    const vendorByProjectName = Object.fromEntries((bpList || []).map(bp => [bp.name, vendorById[bp.vendor_id]?.name || null]));
    const vendorByUserId = Object.fromEntries((usersData || []).map(u => [u.id, vendorById[u.vendor_id]?.name || null]));

    const timesheets = (tsData || []).map(t => ({
      ...t,
      total_hours: (t.entries || []).reduce((s, e) => s + (e.hours || 0), 0),
      vendor_name: vendorByProjectName[t.user_project] || vendorByUserId[t.user_id] || null,
    }));
    return { timesheets, vendors: (vendorList || []) };
  }
  if (p.match(/^\/client\/timesheets\/\d+\/(approve|reject)$/) && method === 'POST') {
    const id = parseInt(p.split('/')[3]);
    const action = p.split('/')[4];
    const updates = {
      client_approval_status: action === 'approve' ? 'approved' : 'rejected',
      client_approved_by: body?.user_id,
      client_approved_at: new Date().toISOString(),
      client_remarks: body?.remarks || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('timesheets').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (p === '/client/invoices' && method === 'GET') {
    const { data, error } = await supabase.from('invoices').select('*, lines:invoice_lines(*)').order('issue_date', { ascending: false });
    if (error) throw new Error(error.message);
    return { invoices: data || [] };
  }
  if (p.match(/^\/client\/invoices\/\d+\/manager-approve$/) && method === 'POST') {
    const id = parseInt(p.split('/')[3]);
    const { data, error } = await supabase.from('invoices').update({
      client_manager_approved_by: body?.user_id,
      client_manager_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { invoice: data };
  }
  if (p.match(/^\/client\/invoices\/\d+\/record-payment$/) && method === 'POST') {
    const id = parseInt(p.split('/')[3]);
    const { data, error } = await supabase.from('invoices').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_remittance_ref: body?.remittance_ref || null,
      payment_receipt_url: body?.receipt_url || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { invoice: data };
  }

  // ── CLIENT VENDORS ──
  if (p === '/client/vendors' && method === 'GET') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('client_id', meRow.client_id)
      .order('status', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return { vendors: data || [] };
  }
  if (p === '/client/vendors' && method === 'POST') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can add vendors');
    const generatedId = body?.id || `VEN-${meRow.client_id}-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase.from('vendors').insert({
      id: generatedId,
      client_id: meRow.client_id,
      name: body.name,
      category: body.category || null,
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      phone: body.phone || null,
      region: body.region || null,
      status: body.status || 'active',
      engagement_start: body.engagement_start || null,
      notes: body.notes || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return { vendor: data };
  }
  if (p.match(/^\/client\/vendors\/[A-Za-z0-9_-]+$/) && method === 'PUT') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can edit vendors');
    const id = p.split('/').pop();
    const allowed = ['name', 'category', 'contact_name', 'contact_email', 'phone', 'region', 'status', 'engagement_start', 'notes'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in (body || {})) updates[k] = body[k];
    const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).eq('client_id', meRow.client_id).select().single();
    if (error) throw new Error(error.message);
    return { vendor: data };
  }

  // ── CLIENT ROSTER ENTRIES (free-form, client-managed) ──
  if (p === '/client/roster-entries' && method === 'POST') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can add roster entries');
    if (!body?.name) throw new Error('Name is required');
    const { data, error } = await supabase.from('roster_entries').insert({
      client_id: meRow.client_id,
      name: body.name,
      role: body.role || null,
      vendor_id: body.vendor_id || null,
      project: body.project || null,
      email: body.email || null,
      billing_rate: body.billing_rate != null ? Number(body.billing_rate) : null,
      currency: body.currency || 'USD',
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      status: body.status || 'active',
      notes: body.notes || null,
      created_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return { entry: data };
  }
  if (p.match(/^\/client\/roster-entries\/\d+$/) && method === 'PUT') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can edit roster entries');
    const id = parseInt(p.split('/').pop(), 10);
    const allowed = ['name', 'role', 'vendor_id', 'project', 'email', 'billing_rate', 'currency', 'start_date', 'end_date', 'status', 'notes'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in (body || {})) updates[k] = body[k];
    const { data, error } = await supabase.from('roster_entries').update(updates).eq('id', id).eq('client_id', meRow.client_id).select().single();
    if (error) throw new Error(error.message);
    return { entry: data };
  }
  if (p.match(/^\/client\/roster-entries\/\d+$/) && method === 'DELETE') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can remove roster entries');
    const id = parseInt(p.split('/').pop(), 10);
    const { error } = await supabase.from('roster_entries').delete().eq('id', id).eq('client_id', meRow.client_id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── CLIENT ROSTER ──
  // Returns employees who have logged hours on any billable project belonging to this client,
  // along with the SOW-agreed billing rate. Pay (cost) rate is intentionally not exposed.
  if (p === '/client/roster' && method === 'GET') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    const myClientId = meRow.client_id;

    const [{ data: bpList }, { data: sowList }, { data: tsList }, { data: empList }, { data: manualRoster }, { data: vendorList }] = await Promise.all([
      supabase.from('billable_projects').select('id, name, bill_rate, currency, billing_type, vendor_id').eq('client_id', myClientId),
      supabase.from('sows').select('id, sow_number, title, resource_name, resource_role, resource_rate, currency, status').eq('client_id', myClientId).in('status', ['signed', 'active', 'finance_approved', 'sent_for_signature']),
      supabase.from('timesheets').select('user_id, user_name, user_project, entries:timesheet_entries(hours, work_item, date)').in('status', ['submitted', 'approved', 'saved']),
      supabase.from('users').select('id, name, designation, project, hourly_rate, email, vendor_id').eq('role', 'employee').eq('is_active', true),
      supabase.from('roster_entries').select('*').eq('client_id', myClientId),
      supabase.from('vendors').select('id, name, category, status').eq('client_id', myClientId).order('name'),
    ]);

    const vendorById = Object.fromEntries((vendorList || []).map(v => [v.id, v]));
    const projectByName = Object.fromEntries((bpList || []).map(bp => [bp.name, bp]));
    const projectNames = new Set(Object.keys(projectByName));
    const empById = Object.fromEntries((empList || []).map(e => [e.id, e]));
    const sowByResource = {};
    for (const s of (sowList || [])) {
      if (s.resource_name) sowByResource[s.resource_name.trim().toLowerCase()] = s;
    }

    // Aggregate hours per user, scoped to this client's projects
    const agg = {};
    for (const ts of (tsList || [])) {
      if (!ts.user_id) continue;
      const onClientProject = ts.user_project && projectNames.has(ts.user_project);
      const entries = (ts.entries || []).filter(e => e.work_item && projectNames.has(e.work_item));
      if (!onClientProject && entries.length === 0) continue;
      if (!agg[ts.user_id]) agg[ts.user_id] = { hours: 0, projects: new Set(), last_entry: null };
      for (const e of entries) {
        agg[ts.user_id].hours += Number(e.hours) || 0;
        agg[ts.user_id].projects.add(e.work_item);
        if (!agg[ts.user_id].last_entry || e.date > agg[ts.user_id].last_entry) agg[ts.user_id].last_entry = e.date;
      }
      // Also include header-level project if no per-entry project match was found
      if (onClientProject && entries.length === 0) agg[ts.user_id].projects.add(ts.user_project);
    }

    const roster = Object.entries(agg).map(([uid, a]) => {
      const emp = empById[uid] || {};
      const projectsArr = Array.from(a.projects);
      // Pick the highest-priority billing rate: SOW resource rate > project bill_rate > employee hourly_rate.
      let billingRate = 0;
      let rateSource = 'employee';
      let currency = 'USD';
      let sowRef = null;
      const sowMatch = sowByResource[(emp.name || '').trim().toLowerCase()];
      if (sowMatch && sowMatch.resource_rate) {
        billingRate = Number(sowMatch.resource_rate);
        currency = sowMatch.currency || 'USD';
        rateSource = 'sow';
        sowRef = { sow_number: sowMatch.sow_number, title: sowMatch.title, status: sowMatch.status };
      } else if (projectsArr.length > 0) {
        const bp = projectByName[projectsArr[0]];
        if (bp && bp.bill_rate) {
          billingRate = Number(bp.bill_rate);
          currency = bp.currency || 'USD';
          rateSource = 'project';
        }
      }
      if (!billingRate && emp.hourly_rate) {
        billingRate = Number(emp.hourly_rate);
        rateSource = 'employee';
      }
      // Determine vendor: prefer user's direct vendor_id, fall back to the vendor of the first matched project.
      let resourceVendorId = emp.vendor_id || null;
      if (!resourceVendorId) {
        for (const pn of projectsArr) {
          const bp = projectByName[pn];
          if (bp?.vendor_id) { resourceVendorId = bp.vendor_id; break; }
        }
      }
      const resourceVendor = resourceVendorId ? vendorById[resourceVendorId] : null;
      return {
        user_id: uid,
        name: emp.name || 'Unknown',
        designation: emp.designation || null,
        email: emp.email || null,
        projects: projectsArr,
        hours_logged: Math.round(a.hours * 100) / 100,
        last_entry: a.last_entry,
        billing_rate: billingRate,
        rate_source: rateSource,
        currency,
        sow: sowRef,
        vendor_id: resourceVendorId,
        vendor_name: resourceVendor?.name || null,
      };
    });

    // Append manual roster entries (client-managed, not tied to timesheets).
    const manualRows = (manualRoster || []).map(m => ({
      entry_id: m.id,
      source: 'manual',
      user_id: null,
      name: m.name,
      designation: m.role,
      email: m.email,
      projects: m.project ? [m.project] : [],
      hours_logged: 0,
      last_entry: null,
      billing_rate: Number(m.billing_rate) || 0,
      rate_source: 'manual',
      currency: m.currency || 'USD',
      sow: null,
      status: m.status,
      vendor_id: m.vendor_id || null,
      vendor_name: m.vendor_id ? (vendorById[m.vendor_id]?.name || null) : null,
      notes: m.notes,
      start_date: m.start_date,
      end_date: m.end_date,
    }));

    const combined = [
      ...roster.map(r => ({ ...r, source: 'timesheet' })),
      ...manualRows,
    ].sort((a, b) => a.name.localeCompare(b.name));

    return {
      roster: combined,
      projects: (bpList || []).map(bp => ({
        id: bp.id, name: bp.name, bill_rate: bp.bill_rate, currency: bp.currency,
        vendor_id: bp.vendor_id || null,
        vendor_name: bp.vendor_id ? (vendorById[bp.vendor_id]?.name || null) : null,
      })),
      vendors: (vendorList || []).map(v => ({ id: v.id, name: v.name, category: v.category, status: v.status })),
    };
  }

  // ── CLIENT DASHBOARD ──
  if (p === '/client/dashboard' && method === 'GET') {
    // Resolve self
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('sb-token-', '').replace('demo-token-', '') : null;
    const { data: meRow } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!meRow) throw new Error('Unauthorized');
    const myClientId = meRow.client_id;
    const [{ data: client }, { data: sowList }, { data: bpList }, { data: invList }, { data: tsList }, { data: empList }, { data: vendorList }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', myClientId).single(),
      supabase.from('sows').select('*').eq('client_id', myClientId).order('created_at', { ascending: false }),
      supabase.from('billable_projects').select('*').eq('client_id', myClientId),
      supabase.from('invoices').select('*, lines:invoice_lines(*)').eq('client_id', myClientId).order('issue_date', { ascending: false }),
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').eq('status', 'submitted'),
      supabase.from('users').select('id, name, project, hourly_rate, vendor_id').eq('role', 'employee').not('hourly_rate', 'is', null),
      supabase.from('vendors').select('*').eq('client_id', myClientId).order('name'),
    ]);
    const myProjectNames = (bpList || []).map(bp => bp.name);
    const tsScoped = (tsList || []).filter(t => myProjectNames.includes(t.user_project)).map(t => ({ ...t, total_hours: (t.entries || []).reduce((s, e) => s + (e.hours || 0), 0) }));
    const sowStatus = {};
    for (const s of (sowList || [])) sowStatus[s.status] = (sowStatus[s.status] || 0) + 1;
    const invoiceTotals = (invList || []).reduce((acc, i) => {
      const a = Number(i.total_amount) || 0;
      acc.total += a;
      if (i.status === 'paid') acc.paid += a;
      else if (i.status !== 'void') acc.outstanding += a;
      return acc;
    }, { total: 0, paid: 0, outstanding: 0 });
    const myActions = [];
    for (const s of (sowList || [])) {
      if (meRow.client_subrole === 'finance' && s.status === 'submitted_for_finance') myActions.push({ kind: 'sow_finance_approve', sow_id: s.id, label: `Approve SOW ${s.sow_number}`, value: s.contract_value });
      if (meRow.client_subrole === 'manager' && s.status === 'sent_for_signature') myActions.push({ kind: 'sow_sign', sow_id: s.id, label: `Sign SOW ${s.sow_number}`, value: s.contract_value });
    }
    if (meRow.client_subrole === 'manager') {
      for (const t of tsScoped) {
        if (!t.client_approval_status || t.client_approval_status === 'pending') myActions.push({ kind: 'timesheet_approve', timesheet_id: t.id, label: `Approve timesheet · ${t.user_name} · ${t.period_label}` });
      }
      for (const inv of (invList || [])) {
        if (inv.status === 'sent' && !inv.client_manager_approved_at) myActions.push({ kind: 'invoice_approve', invoice_id: inv.id, label: `Approve invoice ${inv.invoice_number}`, value: inv.total_amount });
      }
    }
    if (meRow.client_subrole === 'finance') {
      for (const inv of (invList || [])) {
        if (inv.status !== 'paid' && inv.status !== 'void') myActions.push({ kind: 'invoice_pay', invoice_id: inv.id, label: `Record payment for ${inv.invoice_number}`, value: inv.total_amount });
      }
    }
    // Vendor rollup: headcount per vendor + project count per vendor for dashboard card.
    const vendorRollup = (vendorList || []).map(v => {
      const projectsCount = (bpList || []).filter(bp => bp.vendor_id === v.id).length;
      const headcount = (empList || []).filter(e => e.vendor_id === v.id).length;
      return {
        id: v.id, name: v.name, category: v.category, status: v.status,
        projects_count: projectsCount, headcount,
      };
    });

    return {
      client, user: { id: meRow.id, name: meRow.name, subrole: meRow.client_subrole },
      sow_status_counts: sowStatus, sows: (sowList || []).slice(0, 10),
      pending_actions: myActions,
      billing_rates: (empList || []).filter(e => e.hourly_rate > 0).map(e => ({ project: e.project || 'Unassigned', rate: e.hourly_rate, currency: 'USD', billing_type: 'hourly', employee_name: e.name, employee_id: e.id })),
      pending_timesheets: tsScoped,
      invoices: (invList || []).slice(0, 10),
      invoice_totals: invoiceTotals,
      vendors: vendorRollup,
      pending_sow_signatures: (sowList || []).filter(s => s.status === 'sent_for_signature').length,
    };
  }

  // ── BENCH ANALYSIS ──
  if (p === '/finance/bench-analysis' && method === 'GET') {
    const today = new Date();
    const cutoff = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const [{ data: tsData }, { data: usersData }] = await Promise.all([
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').in('status', ['submitted', 'saved']),
      supabase.from('users').select('id, name, project, designation, role, is_active, employee_status, hourly_rate').eq('is_active', true).eq('role', 'employee'),
    ]);
    const hoursByUser = {}, lastEntryByUser = {};
    for (const ts of (tsData || [])) {
      for (const e of (ts.entries || [])) {
        if (!e.hours || !e.date || e.date < cutoff) continue;
        hoursByUser[ts.user_id] = (hoursByUser[ts.user_id] || 0) + e.hours;
        if (!lastEntryByUser[ts.user_id] || e.date > lastEntryByUser[ts.user_id]) lastEntryByUser[ts.user_id] = e.date;
      }
    }
    const FX = { INR: 1 / 83, USD: 1, AED: 1 / 3.67 };
    const salaryByUser = {};
    for (const s of EMPLOYEE_SALARIES) {
      if (s.ctc_amount == null || !s.ctc_currency) continue;
      const fx = FX[s.ctc_currency] || 1;
      let usd = Number(s.ctc_amount) * fx;
      if (s.ctc_period === 'hourly') usd *= 2080;
      else if (s.ctc_period === 'monthly') usd *= 12;
      salaryByUser[s.id] = { annual_usd: usd, raw: s.ctc_raw };
    }
    const items = [];
    let totalBenchCost = 0;
    for (const u of (usersData || [])) {
      const recentHours = hoursByUser[u.id] || 0;
      const salary = salaryByUser[u.id] || { annual_usd: 0, raw: '—' };
      const onBench = recentHours < 40 || u.employee_status === 'bench';
      if (!onBench) continue;
      const monthlyCost = salary.annual_usd / 12;
      totalBenchCost += monthlyCost;
      items.push({
        user_id: u.id, user_name: u.name, project: u.project, designation: u.designation,
        recent_hours: recentHours, last_entry: lastEntryByUser[u.id] || null,
        annual_salary_usd: salary.annual_usd, monthly_cost_usd: monthlyCost,
        salary_raw: salary.raw, status: u.employee_status || 'bench',
      });
    }
    return {
      totals: { count: items.length, monthly_cost_usd: totalBenchCost, annual_cost_usd: totalBenchCost * 12 },
      items: items.sort((a, b) => b.monthly_cost_usd - a.monthly_cost_usd),
    };
  }

  if (p === '/finance/employee-billing' && method === 'GET') {
    const [{ data: tsData }, { data: usersData }] = await Promise.all([
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').in('status', ['submitted', 'saved']),
      supabase.from('users').select('id, name, project, hourly_rate'),
    ]);
    const rateByEmp = Object.fromEntries((usersData || []).map(u => [u.id, u.hourly_rate || 0]));
    const userIndex = Object.fromEntries((usersData || []).map(u => [u.id, u]));
    const byUser = {};
    for (const ts of (tsData || [])) {
      const sowRate = rateByEmp[ts.user_id] || 0;
      for (const e of (ts.entries || [])) {
        if (!e.hours || !e.work_item) continue;
        const revenue = e.hours * sowRate;
        if (!byUser[ts.user_id]) {
          const u = userIndex[ts.user_id];
          byUser[ts.user_id] = { user_id: ts.user_id, user_name: u?.name || ts.user_name, project: u?.project || ts.user_project, rate: sowRate, hours: 0, revenue: 0, payout: 0, by_project: {} };
        }
        byUser[ts.user_id].hours += e.hours;
        byUser[ts.user_id].revenue += revenue;
        if (!byUser[ts.user_id].by_project[e.work_item]) byUser[ts.user_id].by_project[e.work_item] = { project: e.work_item, hours: 0, revenue: 0 };
        byUser[ts.user_id].by_project[e.work_item].hours += e.hours;
        byUser[ts.user_id].by_project[e.work_item].revenue += revenue;
      }
    }
    return { items: Object.values(byUser).sort((a, b) => b.revenue - a.revenue) };
  }

  // ── EMPLOYEE SALARIES ──
  if (p === '/employee-salaries' && method === 'GET') {
    let q = supabase.from('employee_salaries').select('*').order('joined_date', { ascending: false });
    if (query.location) q = q.eq('location', query.location);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // Fallback to static data if table is empty
    if (data && data.length > 0) {
      await logAudit({ action: 'view_salaries', target_type: 'salary', details: { count: data.length } });
      return { salaries: data };
    }
    let rows = [...EMPLOYEE_SALARIES];
    if (query.location) rows = rows.filter(r => r.location === query.location);
    rows.sort((a, b) => (b.joined_date || '').localeCompare(a.joined_date || ''));
    return { salaries: rows };
  }
  if (p === '/employee-salaries' && method === 'POST') {
    const entry = {
      id: body.id,
      first_name: body.first_name,
      last_name: body.last_name,
      title: body.title || null,
      department: body.department || null,
      location: body.location || null,
      joined_date: body.joined_date || null,
      ctc_amount: body.ctc_amount != null ? Number(body.ctc_amount) : null,
      ctc_currency: body.ctc_currency || null,
      ctc_period: body.ctc_period || 'annual',
      ctc_raw: body.ctc_raw || null,
      notes: body.notes || null,
    };
    const { data, error } = await supabase.from('employee_salaries').upsert(entry).select().single();
    if (error) throw new Error(error.message);
    await logAudit({ action: 'upsert_salary', target_type: 'salary', target_id: entry.id, details: { name: `${entry.first_name} ${entry.last_name}` } });
    return { salary: data };
  }
  if (p.match(/^\/employee-salaries\/[^/]+$/) && method === 'PUT') {
    const id = p.split('/')[2];
    const updates = { ...body, updated_at: new Date().toISOString() };
    delete updates.id;
    const { data, error } = await supabase.from('employee_salaries').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    await logAudit({ action: 'update_salary', target_type: 'salary', target_id: id, details: { changed_fields: Object.keys(body) } });
    return { salary: data };
  }
  if (p.match(/^\/employee-salaries\/[^/]+$/) && method === 'DELETE') {
    const id = p.split('/')[2];
    const { error } = await supabase.from('employee_salaries').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit({ action: 'delete_salary', target_type: 'salary', target_id: id });
    return { success: true };
  }

  // ── AUDIT LOGS (admin only) ──
  if (p === '/audit-logs' && method === 'GET') {
    let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (query.action) q = q.eq('action', query.action);
    if (query.user_id) q = q.eq('user_id', query.user_id);
    if (query.target_type) q = q.eq('target_type', query.target_type);
    const limit = parseInt(query.limit) || 200;
    q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: data || [] };
  }

  console.warn('[SupabaseAPI] Unhandled route:', method, path);
  return {};
}
