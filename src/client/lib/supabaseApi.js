import { supabase } from './supabase';

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

function getLoggedInUserId() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_vendor_token') : null;
  if (!token) return null;
  return token.replace('sb-token-', '').replace('demo-token-', '');
}

// ── Supabase API handler ──
export async function supabaseFetch(method, path, body) {
  const { path: p, query } = matchRoute(method, path);

  // ── AUTH ──
  if (p === '/auth/login' && method === 'POST') {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', body.employeeId)
      .eq('role', 'client')
      .eq('is_active', true)
      .single();
    if (error || !data) throw new Error('No client account found with this ID.');
    // Role gating: the chosen role card must match the account's actual subrole.
    // A Finance ID can only sign in under Finance, a Manager ID only under Manager.
    if (body.subrole && data.client_subrole && data.client_subrole !== body.subrole) {
      const actual = data.client_subrole === 'finance' ? 'Client Finance'
        : data.client_subrole === 'manager' ? 'Client Manager' : 'a different role';
      throw new Error(`This ID is a ${actual} login — please select ${actual} to continue.`);
    }
    const token = `sb-token-${data.id}`;
    return { token, user: data };
  }

  if (p === '/auth/me') {
    const userId = getLoggedInUserId();
    if (!userId) throw new Error('Unauthorized');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) throw new Error('User not found');
    return { user: data };
  }

  // ── SOWs ──
  if (p === '/sows' && method === 'GET') {
    // Always scope to the logged-in client's own company — a client manager
    // may only see / approve / sign SOWs for their own team (client_id).
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    let q = supabase.from('sows').select('*').eq('client_id', meRow.client_id).order('created_at', { ascending: false });
    if (query.status) q = q.eq('status', query.status);
    const { data } = await q;
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
    // Attach the admin owner/creator name so the client (finance + manager) can
    // see who from the delivery team raised each SOW.
    const creatorIds = [...new Set((data || []).map(s => s.created_by).filter(Boolean))];
    let creatorNameById = {};
    if (creatorIds.length) {
      const { data: cRows } = await supabase.from('users').select('id, name').in('id', creatorIds);
      creatorNameById = Object.fromEntries((cRows || []).map(u => [u.id, u.name]));
    }
    const enriched = (data || []).map(s => ({
      ...s,
      vendor_name: vendorByProjectId[s.project_id] || null,
      creator_name: creatorNameById[s.created_by] || null,
    }));
    return { sows: enriched };
  }
  if (p.match(/^\/sows\/\d+$/) && method === 'GET') {
    const id = parseInt(p.split('/')[2]);
    const { data, error } = await supabase.from('sows').select('*').eq('id', id).single();
    if (error) throw new Error('SOW not found');
    return { sow: data };
  }
  if (p.match(/^\/sows\/\d+\/(finance-approve|send-for-signature|sign|activate|reject)$/) && method === 'POST') {
    const id = parseInt(p.split('/')[2]);
    const action = p.split('/').pop();
    const statusMap = {
      'finance-approve': 'finance_approved',
      'send-for-signature': 'sent_for_signature',
      sign: 'signed',
      activate: 'active',
      reject: 'rejected',
    };
    const updates = { status: statusMap[action], updated_at: new Date().toISOString() };
    if (action === 'finance-approve') {
      updates.finance_approved_by = body?.user_id;
      updates.finance_approved_at = new Date().toISOString();
    }
    if (action === 'sign') {
      updates.manager_signed_by = body?.user_id;
      updates.manager_signed_at = new Date().toISOString();
    }
    if (action === 'reject') {
      updates.rejected_by = body?.user_id;
      updates.rejected_at = new Date().toISOString();
      updates.rejection_reason = body?.reason || null;
    }
    const { error } = await supabase.from('sows').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── CLIENT TIMESHEETS ──
  if (p === '/timesheets' && method === 'GET') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    const myClientId = meRow?.client_id;
    const [{ data: tsData }, { data: bpList }, { data: usersData }, { data: vendorList }, { data: sowResources }] = await Promise.all([
      supabase.from('timesheets').select('*, entries:timesheet_entries(*)').in('status', ['submitted', 'approved']),
      myClientId ? supabase.from('billable_projects').select('id, name, vendor_id').eq('client_id', myClientId) : Promise.resolve({ data: [] }),
      supabase.from('users').select('id, vendor_id'),
      myClientId ? supabase.from('vendors').select('id, name').eq('client_id', myClientId) : Promise.resolve({ data: [] }),
      supabase.from('sow_resources').select('name, manager'),
    ]);
    const vendorById = Object.fromEntries((vendorList || []).map(v => [v.id, v]));
    const vendorByProjectName = Object.fromEntries((bpList || []).map(bp => [bp.name, vendorById[bp.vendor_id]?.name || null]));
    const vendorByUserId = Object.fromEntries((usersData || []).map(u => [u.id, vendorById[u.vendor_id]?.name || null]));
    // The VCC manager responsible for each resource, keyed by lower-cased name.
    const managerByName = Object.fromEntries(
      (sowResources || []).filter(r => r.name && r.manager).map(r => [r.name.trim().toLowerCase(), r.manager])
    );
    // Show every real submitted/approved timesheet from the delivery team. (We
    // intentionally do NOT filter by billable-project name — timesheet project
    // labels don't always match the billable_projects names exactly, and this is
    // the same data the admin panel sees.)
    const timesheets = (tsData || []).map(t => ({
      ...t, entries: t.timesheet_entries || [], timesheet_entries: undefined,
      vendor_name: vendorByProjectName[t.user_project] || vendorByUserId[t.user_id] || null,
      manager_name: managerByName[(t.user_name || '').trim().toLowerCase()] || null,
    }));
    return { timesheets, vendors: (vendorList || []) };
  }

  // Client manager approves a team timesheet (client-side sign-off, separate
  // from the internal delivery-team approval). Only the manager subrole may.
  if (p.match(/^\/timesheets\/\d+\/client-approve$/) && method === 'POST') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can approve timesheets');
    const id = parseInt(p.split('/')[2], 10);
    const { data, error } = await supabase.from('timesheets').update({
      client_approved_by: userId,
      client_approved_at: new Date().toISOString(),
      client_approval_status: 'approved',
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { timesheet: data };
  }

  // ── CLIENT INVOICES ──
  if (p === '/invoices' && method === 'GET') {
    const { data, error } = await supabase.from('invoices').select('*, lines:invoice_lines(*)').order('issue_date', { ascending: false });
    if (error) throw new Error(error.message);
    return { invoices: data || [] };
  }
  if (p.match(/^\/invoices\/\d+\/manager-approve$/) && method === 'POST') {
    const id = parseInt(p.split('/')[3]);
    const { data, error } = await supabase.from('invoices').update({
      client_manager_approved_by: body?.user_id,
      client_manager_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { invoice: data };
  }
  if (p.match(/^\/invoices\/\d+\/record-payment$/) && method === 'POST') {
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
  if (p === '/vendors' && method === 'GET') {
    const userId = getLoggedInUserId();
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
  if (p === '/vendors' && method === 'POST') {
    const userId = getLoggedInUserId();
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
  if (p.match(/^\/vendors\/[A-Za-z0-9_-]+$/) && method === 'PUT') {
    const userId = getLoggedInUserId();
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

  // ── CLIENT ROSTER ENTRIES ──
  if (p === '/roster-entries' && method === 'POST') {
    const userId = getLoggedInUserId();
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
  if (p.match(/^\/roster-entries\/\d+$/) && method === 'PUT') {
    const userId = getLoggedInUserId();
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
  if (p.match(/^\/roster-entries\/\d+$/) && method === 'DELETE') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id, client_subrole').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    if (meRow.client_subrole !== 'manager') throw new Error('Only client manager can remove roster entries');
    const id = parseInt(p.split('/').pop(), 10);
    const { error } = await supabase.from('roster_entries').delete().eq('id', id).eq('client_id', meRow.client_id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // ── CLIENT ROSTER ──
  // Mirrors the admin User Management list (the delivery workforce) for the
  // client portal. Compensation/CTC is never exposed — only the public-facing
  // profile fields and the contracted SOW bill rate.
  if (p === '/roster' && method === 'GET') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');

    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, phone, role, designation, project, location_type, employee_status, hourly_rate, start_date, end_date, is_active')
      .in('role', ['employee', 'consultant', 'manager'])
      .order('name', { ascending: true });

    return { users: users || [] };
  }

  // ── CLIENT 9-BOX GRID (read-only) ──
  // Mirrors the admin 9-box grid: the same placements the admin sees for the
  // selected period, enriched with the resource's current hourly rate.
  if (p === '/ninebox' && method === 'GET') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');

    let q = supabase.from('ninebox_placements').select('*');
    if (query.period) q = q.eq('period', query.period);
    const { data } = await q;

    const ids = [...new Set((data || []).map(p => p.user_id))];
    let rateMap = {};
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, hourly_rate').in('id', ids);
      rateMap = Object.fromEntries((users || []).map(u => [u.id, u.hourly_rate]));
    }
    const placements = (data || []).map(p => ({ ...p, hourly_rate: rateMap[p.user_id] ?? p.hourly_rate ?? 0 }));
    return { placements };
  }
  // Place / update a resource on the 9-box grid (mirrors the admin grid).
  if (p === '/ninebox' && method === 'POST') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    const { data: userData } = await supabase.from('users').select('name, hourly_rate, project').eq('id', body.userId).single();
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
        placed_by: userId,
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
        placed_by: userId,
      });
    }
    if (body.hourlyRate) await supabase.from('users').update({ hourly_rate: body.hourlyRate }).eq('id', body.userId);
    return { success: true };
  }
  if (p.match(/^\/ninebox\/\d+$/) && method === 'DELETE') {
    const userId = getLoggedInUserId();
    const { data: meRow } = await supabase.from('users').select('client_id').eq('id', userId).single();
    if (!meRow?.client_id) throw new Error('Unauthorized');
    const id = parseInt(p.split('/')[2]);
    await supabase.from('ninebox_placements').delete().eq('id', id);
    return { success: true };
  }

  // ── CLIENT DASHBOARD ──
  if (p === '/dashboard' && method === 'GET') {
    const userId = getLoggedInUserId();
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
    // Last 4 calendar months of total billing (by invoice issue date).
    const monthly_billing = (() => {
      const now = new Date();
      const buckets = [];
      for (let k = 3; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), total: 0 });
      }
      const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));
      for (const inv of (invList || [])) {
        if (inv.status === 'void' || !inv.issue_date) continue;
        const key = String(inv.issue_date).slice(0, 7);
        if (byKey[key]) byKey[key].total += Number(inv.total_amount) || 0;
      }
      return buckets;
    })();
    const myActions = [];
    for (const s of (sowList || [])) {
      if (meRow.client_subrole === 'finance' && s.status === 'submitted_for_finance') myActions.push({ kind: 'sow_finance_approve', sow_id: s.id, label: `Approve SOW ${s.sow_number}`, value: s.contract_value });
      if (meRow.client_subrole === 'manager' && s.status === 'submitted_for_finance') myActions.push({ kind: 'sow_approve', sow_id: s.id, label: `Approve SOW ${s.sow_number}`, value: s.contract_value });
      if (meRow.client_subrole === 'manager' && s.status === 'sent_for_signature') myActions.push({ kind: 'sow_sign', sow_id: s.id, label: `Sign SOW ${s.sow_number}`, value: s.contract_value });
    }
    if (meRow.client_subrole === 'manager') {
      // The client manager approves timesheets but NOT invoices (invoices are read-only for them).
      for (const t of tsScoped) {
        if (t.status === 'submitted' && t.client_approval_status !== 'approved') {
          myActions.push({ kind: 'timesheet_approve', timesheet_id: t.id, label: `Approve timesheet · ${t.user_name || t.user_id}`, value: null });
        }
      }
    }
    if (meRow.client_subrole === 'finance') {
      // Finance approves invoices first, then records payment on approved ones.
      for (const inv of (invList || [])) {
        if (inv.status === 'void') continue;
        if (!inv.client_manager_approved_at) myActions.push({ kind: 'invoice_approve', invoice_id: inv.id, label: `Approve invoice ${inv.invoice_number}`, value: inv.total_amount });
        else if (inv.status !== 'paid') myActions.push({ kind: 'invoice_pay', invoice_id: inv.id, label: `Record payment for ${inv.invoice_number}`, value: inv.total_amount });
      }
    }
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
      monthly_billing,
      vendors: vendorRollup,
      pending_sow_signatures: (sowList || []).filter(s => s.status === 'sent_for_signature').length,
    };
  }

  console.warn('[VendorAPI] Unhandled route:', method, path);
  return {};
}
