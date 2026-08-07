import {
  users, projects, leaveBalances, leaves, tasks, timesheets,
  documents, frozenPeriods, requirements, meetings, meetingActions,
  salesDeals, nineboxPlacements, clients, billableProjects, invoices, holidays, sows,
} from './demoData';
import { EMPLOYEE_SALARIES } from '../data/employeeSalaries';

// Deep clone helper
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// In-memory mutable stores (so creates/updates persist during session)
const store = {
  users: clone(users),
  leaveBalances: clone(leaveBalances),
  leaves: clone(leaves),
  tasks: clone(tasks),
  timesheets: clone(timesheets),
  documents: clone(documents),
  frozenPeriods: clone(frozenPeriods),
  requirements: clone(requirements),
  meetings: clone(meetings),
  meetingActions: clone(meetingActions),
  salesDeals: clone(salesDeals),
  nineboxPlacements: clone(nineboxPlacements),
  referrals: [],
  clients: clone(clients),
  billableProjects: clone(billableProjects),
  invoices: clone(invoices),
  holidays: clone(holidays),
  sows: clone(sows),
};

let nextId = {
  leaves: 100,
  tasks: 100,
  timesheets: 100,
  documents: 100,
  requirements: 100,
  meetings: 100,
  meetingActions: 100,
  salesDeals: 100,
  salesActivities: 100,
  nineboxPlacements: 100,
  referrals: 100,
  invoices: 100,
  sows: 100,
};

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
  // Remove /api prefix
  const p = path.split('?')[0].replace(/^\/api/, '');
  return { method, path: p, query: parseQuery(path) };
}

// ── Mock API handler ──
export async function mockFetch(method, path, body) {
  // Small delay to feel realistic
  await new Promise(r => setTimeout(r, 50));

  const { path: p, query } = matchRoute(method, path);

  // ── AUTH ──
  if (p === '/auth/login' && method === 'POST') {
    const user = store.users.find(u => u.id === body.employeeId && u.role === body.role && u.is_active);
    if (!user) throw new Error('Invalid credentials');
    return { token: 'demo-token-' + user.id, user: clone(user) };
  }
  if (p === '/auth/me') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    if (!token) throw new Error('Unauthorized');
    const userId = token.replace('demo-token-', '');
    const user = store.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    return { user: clone(user) };
  }

  // ── USERS-PUBLIC ──
  if (p === '/users-public') {
    let filtered = store.users.filter(u => u.is_active);
    if (query.role) filtered = filtered.filter(u => u.role === query.role);
    return { users: filtered.map(u => ({ id: u.id, name: u.name, role: u.role, project: u.project, designation: u.designation, client_id: u.client_id, client_subrole: u.client_subrole })) };
  }

  // ── USERS ──
  if (p === '/users' && method === 'GET') {
    let filtered = query.include_all === 'true' ? store.users : store.users.filter(u => u.is_active);
    if (query.role) filtered = filtered.filter(u => u.role === query.role);
    if (query.project) filtered = filtered.filter(u => u.project === query.project);
    return { users: clone(filtered).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  if (p.match(/^\/users\/[^/]+$/) && method === 'GET') {
    const id = p.split('/')[2];
    const user = store.users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    return { user: clone(user) };
  }
  if (p === '/users' && method === 'POST') {
    const newUser = { ...body, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.users.push(newUser);
    // Seed leave balances
    ['casual', 'sick', 'earned'].forEach(type => {
      store.leaveBalances.push({ id: `${newUser.id}_${type}`, user_id: newUser.id, leave_type: type, year: 2026, total_days: type === 'casual' ? 12 : type === 'sick' ? 10 : 15, used_days: 0 });
    });
    return { user: clone(newUser) };
  }
  if (p.match(/^\/users\/[^/]+$/) && method === 'PUT') {
    const id = p.split('/')[2];
    const idx = store.users.findIndex(u => u.id === id);
    if (idx >= 0) store.users[idx] = { ...store.users[idx], ...body, updated_at: new Date().toISOString() };
    return { user: clone(store.users[idx]) };
  }
  if (p.match(/^\/users\/[^/]+$/) && method === 'DELETE') {
    const id = p.split('/')[2];
    const idx = store.users.findIndex(u => u.id === id);
    if (idx >= 0) store.users[idx].is_active = 0;
    return { success: true };
  }

  // ── TIMESHEETS ──
  if (p === '/timesheets' && method === 'GET') {
    const { userId, period } = query;
    if (userId && period) {
      const ts = store.timesheets.find(t => t.user_id === userId && t.period_label === period);
      return { timesheet: ts ? clone(ts) : null };
    }
    return { timesheet: null };
  }
  if (p.match(/^\/timesheets\/user\/[^/]+$/) && method === 'GET') {
    const userId = p.split('/')[3];
    const userTs = store.timesheets.filter(t => t.user_id === userId);
    return { timesheets: clone(userTs) };
  }
  if (p === '/timesheets/all' && method === 'GET') {
    let filtered = clone(store.timesheets);
    if (query.period) filtered = filtered.filter(t => t.period_label === query.period);
    return { timesheets: filtered };
  }
  if (p === '/timesheets' && method === 'POST') {
    const { userId, periodLabel, entries, status = 'saved' } = body;
    const existing = store.timesheets.findIndex(t => t.user_id === userId && t.period_label === periodLabel);
    const userName = store.users.find(u => u.id === userId)?.name || '';
    const userProject = store.users.find(u => u.id === userId)?.project || '';
    if (existing >= 0) {
      store.timesheets[existing] = { ...store.timesheets[existing], entries: entries || [], status, updated_at: new Date().toISOString() };
      return { success: true, id: store.timesheets[existing].id };
    }
    const id = nextId.timesheets++;
    store.timesheets.push({ id, user_id: userId, user_name: userName, user_project: userProject, period_label: periodLabel, status, entries: entries || [], updated_at: new Date().toISOString() });
    return { success: true, id };
  }
  if (p.match(/^\/timesheets\/\d+\/submit$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.timesheets.findIndex(t => t.id === id);
    if (idx >= 0) { store.timesheets[idx].status = 'submitted'; store.timesheets[idx].updated_at = new Date().toISOString(); }
    return { success: true };
  }

  // ── FREEZE ──
  if (p === '/freeze' && method === 'GET') {
    if (!query.period) return { frozen: false };
    const row = store.frozenPeriods.find(f => f.period_label === query.period && (f.project === (query.project || null) || !f.project));
    return { frozen: !!row, frozenPeriod: row || null };
  }
  if (p === '/freeze/all' && method === 'GET') {
    return { frozenPeriods: clone(store.frozenPeriods) };
  }
  if (p === '/freeze' && method === 'POST') {
    store.frozenPeriods.push({ id: store.frozenPeriods.length + 1, period_label: body.periodLabel, project: body.project || null, frozen_at: new Date().toISOString() });
    return { success: true };
  }

  // ── DOCUMENTS ──
  if (p === '/documents' && method === 'GET') {
    let docs = clone(store.documents);
    if (query.userId) docs = docs.filter(d => d.user_id === query.userId);
    return { documents: docs };
  }
  if (p === '/documents' && method === 'POST') {
    const id = nextId.documents++;
    store.documents.push({ id, user_id: body.userId || body.get?.('userId'), doc_type: body.docType || body.get?.('docType'), original_name: 'Uploaded_Document.pdf', stored_name: `doc_${id}.pdf`, file_size: 100000, mime_type: 'application/pdf', uploaded_by: body.uploadedBy || 'ADM001', uploaded_at: new Date().toISOString() });
    return { success: true };
  }
  if (p.match(/^\/documents\/\d+\/download$/) && method === 'GET') {
    // Return a fake blob response for demo
    return new Response('Demo file content', { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="demo.pdf"' } });
  }
  if (p.match(/^\/documents\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    store.documents = store.documents.filter(d => d.id !== id);
    return { success: true };
  }

  // ── REQUIREMENTS ──
  if (p === '/requirements' && method === 'GET') {
    let reqs = clone(store.requirements);
    if (query.status) reqs = reqs.filter(r => r.status === query.status);
    return { requirements: reqs };
  }
  if (p === '/requirements' && method === 'POST') {
    const id = nextId.requirements++;
    store.requirements.push({ id, title: body.title, description: body.description, project: body.project, location_type: body.locationType, location_detail: body.locationDetail, positions_count: body.positionsCount || 1, skills: body.skills, priority: body.priority || 'medium', status: 'open', created_by: body.createdBy || 'ADM001', requested_by: body.requestedBy || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/requirements\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.requirements.findIndex(r => r.id === id);
    if (idx >= 0) store.requirements[idx] = { ...store.requirements[idx], ...body, updated_at: new Date().toISOString() };
    return { success: true };
  }
  if (p.match(/^\/requirements\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    store.requirements = store.requirements.filter(r => r.id !== id);
    return { success: true };
  }

  // ── REFERRALS ──
  if (p === '/referrals' && method === 'GET') {
    let refs = clone(store.referrals);
    if (query.userId) refs = refs.filter(r => r.referred_by === query.userId);
    return { referrals: refs };
  }
  if (p === '/referrals' && method === 'POST') {
    const id = nextId.referrals++;
    store.referrals.push({ id, requirement_id: body.requirementId ? parseInt(body.requirementId) : null, candidate_name: body.candidateName, candidate_email: body.candidateEmail, candidate_phone: body.candidatePhone, referred_by: body.referredBy, referred_by_name: body.referredByName, notes: body.notes, status: 'submitted', created_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/referrals\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.referrals.findIndex(r => r.id === id);
    if (idx >= 0) store.referrals[idx] = { ...store.referrals[idx], ...body, updated_at: new Date().toISOString() };
    return { success: true };
  }

  // ── LEAVES ──
  if (p === '/leaves' && method === 'GET') {
    let lvs = clone(store.leaves);
    if (query.userId) lvs = lvs.filter(l => l.user_id === query.userId);
    if (query.status) lvs = lvs.filter(l => l.status === query.status);
    if (query.from) lvs = lvs.filter(l => l.start_date >= query.from);
    if (query.to) lvs = lvs.filter(l => l.start_date <= query.to);
    if (query.project) {
      const projUserIds = store.users.filter(u => u.project === query.project).map(u => u.id);
      lvs = lvs.filter(l => projUserIds.includes(l.user_id));
    }
    lvs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return { leaves: lvs };
  }
  if (p.match(/^\/leaves\/balances\/[^/]+$/) && method === 'GET') {
    const userId = p.split('/')[3];
    const balances = store.leaveBalances.filter(b => b.user_id === userId);
    return { balances: clone(balances) };
  }
  if (p === '/leaves' && method === 'POST') {
    const id = nextId.leaves++;
    const userName = store.users.find(u => u.id === body.userId)?.name || '';
    store.leaves.push({ id, user_id: body.userId, user_name: userName, leave_type: body.leaveType, start_date: body.startDate, end_date: body.endDate, days_count: body.daysCount, reason: body.reason, status: 'pending', approved_by: null, approved_at: null, created_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/leaves\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.leaves.findIndex(l => l.id === id);
    if (idx >= 0) {
      store.leaves[idx] = { ...store.leaves[idx], status: body.status, approved_by: body.approvedBy, approved_at: new Date().toISOString() };
      if (body.status === 'approved') {
        const leave = store.leaves[idx];
        const balIdx = store.leaveBalances.findIndex(b => b.user_id === leave.user_id && b.leave_type === leave.leave_type);
        if (balIdx >= 0) store.leaveBalances[balIdx].used_days += leave.days_count;
      }
    }
    return { success: true };
  }

  // ── TASKS ──
  if (p === '/tasks' && method === 'GET') {
    let t = clone(store.tasks);
    if (query.userId) t = t.filter(x => x.user_id === query.userId);
    if (query.date) t = t.filter(x => x.date === query.date);
    if (query.status) t = t.filter(x => x.status === query.status);
    if (query.assignedBy) t = t.filter(x => x.assigned_by === query.assignedBy);
    return { tasks: t };
  }
  if (p.match(/^\/tasks\/kpi\/[^/]+$/) && method === 'GET') {
    const userId = p.split('/')[3];
    let t = store.tasks.filter(x => x.user_id === userId);
    if (query.period) t = t.filter(x => x.date.startsWith(query.period));
    const completed = t.filter(x => x.status === 'completed');
    const avgHours = completed.length > 0 ? completed.reduce((s, x) => s + (x.actual_hours || x.estimated_hours || 0), 0) / completed.length : 0;
    return { tasks_assigned: t.length, tasks_completed: completed.length, avg_hours: avgHours, employees: [{ user_id: userId, assigned: t.length, completed: completed.length }] };
  }
  if (p === '/tasks' && method === 'POST') {
    const id = nextId.tasks++;
    const userName = store.users.find(u => u.id === body.userId)?.name || '';
    const assignedByName = store.users.find(u => u.id === body.assignedBy)?.name || '';
    store.tasks.push({ id, user_id: body.userId, user_name: userName, assigned_by: body.assignedBy, assigned_by_name: assignedByName, title: body.title, description: body.description, date: body.date, priority: body.priority || 'medium', status: 'pending', estimated_hours: body.estimatedHours, actual_hours: null, completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/tasks\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
      const updates = { ...body, updated_at: new Date().toISOString() };
      if (body.status === 'completed') updates.completed_at = new Date().toISOString();
      store.tasks[idx] = { ...store.tasks[idx], ...updates };
    }
    return { success: true };
  }
  if (p.match(/^\/tasks\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    store.tasks = store.tasks.filter(t => t.id !== id);
    return { success: true };
  }

  // ── MEETINGS ──
  if (p === '/meetings' && method === 'GET') {
    let m = clone(store.meetings);
    if (query.project) m = m.filter(x => x.project === query.project);
    if (query.month) m = m.filter(x => x.date.startsWith(query.month));
    return { meetings: m };
  }
  if (p === '/meetings' && method === 'POST') {
    const id = nextId.meetings++;
    const creatorName = store.users.find(u => u.id === (body.createdBy || 'ADM001'))?.name || '';
    store.meetings.push({ id, title: body.title, date: body.date, time: body.time, attendees: body.attendees, notes: body.notes, project: body.project, created_by: body.createdBy || 'ADM001', created_by_name: creatorName, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/meetings\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.meetings.findIndex(m => m.id === id);
    if (idx >= 0) store.meetings[idx] = { ...store.meetings[idx], ...body, updated_at: new Date().toISOString() };
    return { success: true };
  }
  if (p.match(/^\/meetings\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    store.meetings = store.meetings.filter(m => m.id !== id);
    store.meetingActions = store.meetingActions.filter(a => a.meeting_id !== id);
    return { success: true };
  }
  if (p.match(/^\/meetings\/\d+\/actions$/) && method === 'GET') {
    const meetingId = parseInt(p.split('/')[2]);
    const actions = store.meetingActions.filter(a => a.meeting_id === meetingId);
    return { actions: clone(actions) };
  }
  if (p.match(/^\/meetings\/\d+\/actions$/) && method === 'POST') {
    const meetingId = parseInt(p.split('/')[2]);
    const id = nextId.meetingActions++;
    const assignedName = store.users.find(u => u.id === body.assignedTo)?.name || '';
    store.meetingActions.push({ id, meeting_id: meetingId, description: body.description, assigned_to: body.assignedTo || null, assigned_to_name: assignedName, due_date: body.dueDate || null, status: 'open', completed_at: null, created_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/meetings\/actions\/\d+$/) && method === 'PUT') {
    const actionId = parseInt(p.split('/')[3]);
    const idx = store.meetingActions.findIndex(a => a.id === actionId);
    if (idx >= 0) {
      if (body.status) {
        store.meetingActions[idx].status = body.status;
        store.meetingActions[idx].completed_at = body.status === 'completed' ? new Date().toISOString() : null;
      }
      if (body.description !== undefined) store.meetingActions[idx].description = body.description;
    }
    return { success: true };
  }

  // ── SALES ──
  if (p === '/sales' && method === 'GET') {
    let deals = clone(store.salesDeals);
    if (query.stage) deals = deals.filter(d => d.stage === query.stage);
    if (query.ownerId) deals = deals.filter(d => d.owner_id === query.ownerId);
    return { deals };
  }
  if (p === '/sales' && method === 'POST') {
    const id = nextId.salesDeals++;
    store.salesDeals.push({ id, title: body.title, client_name: body.clientName, deal_value: body.dealValue || 0, currency: body.currency || 'USD', stage: body.stage || 'prospect', probability: body.probability || 0, expected_close_date: body.expectedCloseDate, owner_id: body.ownerId, notes: body.notes, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { id };
  }
  if (p.match(/^\/sales\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.salesDeals.findIndex(d => d.id === id);
    if (idx >= 0) {
      const updates = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.clientName !== undefined) updates.client_name = body.clientName;
      if (body.dealValue !== undefined) updates.deal_value = body.dealValue;
      if (body.currency !== undefined) updates.currency = body.currency;
      if (body.stage !== undefined) updates.stage = body.stage;
      if (body.probability !== undefined) updates.probability = body.probability;
      if (body.expectedCloseDate !== undefined) updates.expected_close_date = body.expectedCloseDate;
      if (body.notes !== undefined) updates.notes = body.notes;
      store.salesDeals[idx] = { ...store.salesDeals[idx], ...updates, updated_at: new Date().toISOString() };
    }
    return { success: true };
  }
  if (p.match(/^\/sales\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    store.salesDeals = store.salesDeals.filter(d => d.id !== id);
    return { success: true };
  }
  if (p.match(/^\/sales\/\d+\/activities$/) && method === 'GET') {
    return { activities: [] };
  }
  if (p.match(/^\/sales\/\d+\/activities$/) && method === 'POST') {
    return { success: true };
  }

  // ── NINEBOX ──
  if (p === '/ninebox' && method === 'GET') {
    let placements = clone(store.nineboxPlacements);
    if (query.period) placements = placements.filter(p => p.period === query.period);
    // Enrich with current hourly_rate from users
    placements = placements.map(p => {
      const u = store.users.find(u => u.id === p.user_id);
      return { ...p, hourly_rate: u?.hourly_rate ?? p.hourly_rate ?? 0 };
    });
    return { placements };
  }
  if (p === '/ninebox' && method === 'POST') {
    const existing = store.nineboxPlacements.findIndex(p => p.user_id === body.userId && p.period === body.period);
    if (existing >= 0) {
      store.nineboxPlacements[existing] = { ...store.nineboxPlacements[existing], potential: body.potential, performance: body.performance, notes: body.notes, placed_by: body.placedBy || 'ADM001', placed_at: new Date().toISOString() };
    } else {
      const id = nextId.nineboxPlacements++;
      const userName = store.users.find(u => u.id === body.userId)?.name || '';
      const user = store.users.find(u => u.id === body.userId);
      store.nineboxPlacements.push({ id, user_id: body.userId, user_name: userName, hourly_rate: user?.hourly_rate || 0, project: user?.project, potential: body.potential, performance: body.performance, period: body.period, notes: body.notes, placed_by: body.placedBy || 'ADM001', placed_at: new Date().toISOString() });
    }
    return { success: true };
  }
  if (p.match(/^\/ninebox\/\d+$/) && method === 'PUT') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.nineboxPlacements.findIndex(n => n.id === id);
    if (idx >= 0) store.nineboxPlacements[idx] = { ...store.nineboxPlacements[idx], ...body };
    return { success: true };
  }
  if (p.match(/^\/ninebox\/\d+$/) && method === 'DELETE') {
    const id = parseInt(p.split('/')[2]);
    store.nineboxPlacements = store.nineboxPlacements.filter(n => n.id !== id);
    return { success: true };
  }

  // ── REPORTS ──
  if (p === '/reports/timesheet-summary') {
    const employees = store.users.filter(u => u.is_active && u.role === 'employee');
    const byProject = {};
    for (const emp of employees) {
      const proj = emp.project || 'Unassigned';
      if (!byProject[proj]) byProject[proj] = { project: proj, employee_count: 0, submitted_count: 0, total_hours: 0 };
      byProject[proj].employee_count++;
      const ts = store.timesheets.find(t => t.user_id === emp.id && (!query.period || t.period_label === query.period));
      if (ts?.status === 'submitted') byProject[proj].submitted_count++;
      if (ts) byProject[proj].total_hours += (ts.entries || []).reduce((s, e) => s + (e.hours || 0), 0);
    }
    return { summary: Object.values(byProject) };
  }
  if (p === '/reports/leave-summary') {
    const approved = store.leaves.filter(l => l.status === 'approved');
    const byType = {};
    for (const l of approved) {
      if (!byType[l.leave_type]) byType[l.leave_type] = { leave_type: l.leave_type, total_days: 0, count: 0 };
      byType[l.leave_type].total_days += l.days_count;
      byType[l.leave_type].count++;
    }
    const byEmployee = {};
    for (const l of approved) {
      if (!byEmployee[l.user_id]) byEmployee[l.user_id] = { user_id: l.user_id, user_name: l.user_name, total_days: 0 };
      byEmployee[l.user_id].total_days += l.days_count;
    }
    return { by_type: Object.values(byType), by_employee: Object.values(byEmployee).sort((a, b) => b.total_days - a.total_days) };
  }
  if (p === '/reports/task-summary') {
    const byUser = {};
    for (const t of store.tasks) {
      if (!byUser[t.user_id]) byUser[t.user_id] = { user_id: t.user_id, user_name: t.user_name, assigned: 0, completed: 0, blocked: 0 };
      byUser[t.user_id].assigned++;
      if (t.status === 'completed') byUser[t.user_id].completed++;
      if (t.status === 'blocked') byUser[t.user_id].blocked++;
    }
    return { employees: Object.values(byUser).sort((a, b) => b.completed - a.completed) };
  }
  if (p === '/reports/sales-pipeline') {
    const stageOrder = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const byStage = {};
    for (const d of store.salesDeals) {
      if (!byStage[d.stage]) byStage[d.stage] = { stage: d.stage, count: 0, total_value: 0 };
      byStage[d.stage].count++;
      byStage[d.stage].total_value += d.deal_value;
    }
    return { stages: stageOrder.filter(s => byStage[s]).map(s => byStage[s]) };
  }

  // ── FINANCE: gate helper ──
  function currentRole() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('demo-token-', '').replace('sb-token-', '') : null;
    const user = store.users.find(u => u.id === userId);
    return user?.role || null;
  }
  function requireFinance() {
    const role = currentRole();
    if (role !== 'admin' && role !== 'finance') throw new Error('Forbidden');
  }

  // ── CLIENTS ──
  if (p === '/clients' && method === 'GET') {
    requireFinance();
    return { clients: clone(store.clients) };
  }
  if (p === '/clients' && method === 'POST') {
    requireFinance();
    const id = body.id || `CLT${String(store.clients.length + 1).padStart(3, '0')}`;
    const newClient = { id, name: body.name, region: body.region || null, contact_name: body.contact_name || null, contact_email: body.contact_email || null, status: body.status || 'active', notes: body.notes || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.clients.push(newClient);
    return { client: clone(newClient) };
  }
  if (p.match(/^\/clients\/[^/]+$/) && method === 'PUT') {
    requireFinance();
    const id = p.split('/')[2];
    const idx = store.clients.findIndex(c => c.id === id);
    if (idx >= 0) store.clients[idx] = { ...store.clients[idx], ...body, updated_at: new Date().toISOString() };
    return { client: clone(store.clients[idx]) };
  }
  if (p.match(/^\/clients\/[^/]+$/) && method === 'DELETE') {
    requireFinance();
    const id = p.split('/')[2];
    store.clients = store.clients.filter(c => c.id !== id);
    return { success: true };
  }

  // ── BILLABLE PROJECTS (rate cards) ──
  if (p === '/billable-projects' && method === 'GET') {
    requireFinance();
    let rows = clone(store.billableProjects);
    if (query.client_id) rows = rows.filter(r => r.client_id === query.client_id);
    return { projects: rows };
  }
  if (p === '/billable-projects' && method === 'POST') {
    requireFinance();
    const id = body.id || `BP${String(store.billableProjects.length + 1).padStart(3, '0')}`;
    const row = { id, name: body.name, client_id: body.client_id || null, billing_type: body.billing_type || 'hourly', bill_rate: Number(body.bill_rate) || 0, currency: body.currency || 'USD', status: body.status || 'active', notes: body.notes || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.billableProjects.push(row);
    return { project: clone(row) };
  }
  if (p.match(/^\/billable-projects\/[^/]+$/) && method === 'PUT') {
    requireFinance();
    const id = p.split('/')[2];
    const idx = store.billableProjects.findIndex(r => r.id === id);
    if (idx >= 0) store.billableProjects[idx] = { ...store.billableProjects[idx], ...body, updated_at: new Date().toISOString() };
    return { project: clone(store.billableProjects[idx]) };
  }
  if (p.match(/^\/billable-projects\/[^/]+$/) && method === 'DELETE') {
    requireFinance();
    const id = p.split('/')[2];
    store.billableProjects = store.billableProjects.filter(r => r.id !== id);
    return { success: true };
  }

  // ── INVOICES ──
  if (p === '/invoices' && method === 'GET') {
    requireFinance();
    let rows = clone(store.invoices);
    if (query.client_id) rows = rows.filter(r => r.client_id === query.client_id);
    if (query.status) rows = rows.filter(r => r.status === query.status);
    rows.sort((a, b) => (b.issue_date || b.created_at).localeCompare(a.issue_date || a.created_at));
    return { invoices: rows };
  }
  if (p.match(/^\/invoices\/\d+$/) && method === 'GET') {
    requireFinance();
    const id = parseInt(p.split('/')[2]);
    const inv = store.invoices.find(i => i.id === id);
    if (!inv) throw new Error('Invoice not found');
    return { invoice: clone(inv) };
  }
  if (p === '/invoices' && method === 'POST') {
    requireFinance();
    const id = nextId.invoices++;
    const number = body.invoice_number || `INV-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
    const lines = (body.lines || []).map((l, i) => ({ ...l, id: i + 1, amount: Number(l.amount) || (Number(l.hours || 0) * Number(l.rate || 0)) }));
    const subtotal = lines.reduce((s, l) => s + (l.amount || 0), 0);
    const inv = {
      id, invoice_number: number, client_id: body.client_id,
      period_start: body.period_start, period_end: body.period_end,
      issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
      due_date: body.due_date || null,
      currency: body.currency || 'USD',
      subtotal, total_amount: Number(body.total_amount) || subtotal,
      status: body.status || 'draft', paid_at: null,
      notes: body.notes || null,
      created_by: currentRole() === 'finance' ? 'FIN001' : 'ADM001',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      lines,
    };
    store.invoices.push(inv);
    return { invoice: clone(inv) };
  }
  if (p.match(/^\/invoices\/\d+$/) && method === 'PUT') {
    requireFinance();
    const id = parseInt(p.split('/')[2]);
    const idx = store.invoices.findIndex(i => i.id === id);
    if (idx < 0) throw new Error('Invoice not found');
    let lines = store.invoices[idx].lines;
    if (Array.isArray(body.lines)) {
      lines = body.lines.map((l, i) => ({ ...l, id: l.id ?? i + 1, amount: Number(l.amount) || (Number(l.hours || 0) * Number(l.rate || 0)) }));
    }
    const subtotal = lines.reduce((s, l) => s + (l.amount || 0), 0);
    store.invoices[idx] = { ...store.invoices[idx], ...body, lines, subtotal, total_amount: Number(body.total_amount) || subtotal, paid_at: body.status === 'paid' ? (store.invoices[idx].paid_at || new Date().toISOString()) : store.invoices[idx].paid_at, updated_at: new Date().toISOString() };
    return { invoice: clone(store.invoices[idx]) };
  }
  if (p.match(/^\/invoices\/\d+$/) && method === 'DELETE') {
    requireFinance();
    const id = parseInt(p.split('/')[2]);
    store.invoices = store.invoices.filter(i => i.id !== id);
    return { success: true };
  }

  // ── FINANCE SUMMARY (revenue / payout / margin from logged hours × project rate) ──
  if (p === '/finance/summary' && method === 'GET') {
    requireFinance();
    const from = query.from || null;
    const to = query.to || null;
    // Revenue = SOW billing rate × hours; Payout = salary-derived hourly cost × hours
    // Overhead factor: 17% of revenue goes to insurance, vendor costs, etc.
    const OVERHEAD_PCT = 0.17;
    const rateByEmp = Object.fromEntries(store.users.map(u => [u.id, u.hourly_rate || 0]));
    const empName = Object.fromEntries(store.users.map(u => [u.id, u.name]));

    // Compute hourly cost from salary data
    const FX = { INR: 1 / 83, USD: 1, AED: 1 / 3.67 };
    const HOURS_PER_YEAR = 2080;
    const costByEmp = {};
    for (const s of EMPLOYEE_SALARIES) {
      if (s.ctc_amount == null || !s.ctc_currency) continue;
      const fx = FX[s.ctc_currency] || 1;
      let annualUsd = Number(s.ctc_amount) * fx;
      if (s.ctc_period === 'hourly') annualUsd *= HOURS_PER_YEAR;
      else if (s.ctc_period === 'monthly') annualUsd *= 12;
      costByEmp[s.id] = annualUsd / HOURS_PER_YEAR;
    }

    const submitted = store.timesheets.filter(t => t.status === 'submitted' || t.status === 'saved');
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);

    let totalHours = 0, totalRevenue = 0, totalPayout = 0;
    const byProject = {};
    const byDay = {};
    const byEmployee = {};
    const byProjectDay = {};

    const empProject = Object.fromEntries(store.users.map(u => [u.id, u.project]));
    for (const ts of submitted) {
      const sowRate = rateByEmp[ts.user_id] || 0;
      const hourlyCost = costByEmp[ts.user_id] || 0;
      const proj = empProject[ts.user_id] || 'Unassigned';
      for (const e of (ts.entries || [])) {
        if (!e.hours) continue;
        if (!inRange(e.date)) continue;
        const revenue = e.hours * sowRate;
        const overhead = revenue * OVERHEAD_PCT;
        const payout = e.hours * hourlyCost + overhead;

        totalHours += e.hours;
        totalRevenue += revenue;
        totalPayout += payout;

        if (!byProject[proj]) byProject[proj] = { project: proj, hours: 0, revenue: 0, payout: 0, rate: 0 };
        byProject[proj].hours += e.hours;
        byProject[proj].revenue += revenue;
        byProject[proj].payout += payout;

        if (!byDay[e.date]) byDay[e.date] = { date: e.date, hours: 0, revenue: 0, payout: 0 };
        byDay[e.date].hours += e.hours;
        byDay[e.date].revenue += revenue;
        byDay[e.date].payout += payout;

        if (!byProjectDay[proj]) byProjectDay[proj] = {};
        if (!byProjectDay[proj][e.date]) byProjectDay[proj][e.date] = { date: e.date, hours: 0, revenue: 0, payout: 0 };
        byProjectDay[proj][e.date].hours += e.hours;
        byProjectDay[proj][e.date].revenue += revenue;
        byProjectDay[proj][e.date].payout += payout;

        if (!byEmployee[ts.user_id]) byEmployee[ts.user_id] = { user_id: ts.user_id, user_name: empName[ts.user_id] || ts.user_name, hours: 0, revenue: 0, payout: 0, rate: sowRate, cost_rate: hourlyCost };
        byEmployee[ts.user_id].hours += e.hours;
        byEmployee[ts.user_id].revenue += revenue;
        byEmployee[ts.user_id].payout += payout;
      }
    }

    // Compute average rate per project
    for (const proj of Object.values(byProject)) {
      if (proj.hours > 0) proj.rate = Math.round(proj.revenue / proj.hours);
    }

    const byProjectDaySeries = Object.fromEntries(
      Object.entries(byProjectDay).map(([proj, days]) => [
        proj,
        Object.values(days).sort((a, b) => a.date.localeCompare(b.date)),
      ])
    );

    const margin = totalRevenue - totalPayout;
    const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    return {
      totals: {
        hours: totalHours,
        revenue: totalRevenue,
        payout: Math.round(totalPayout),
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
    let rows = clone(store.holidays);
    if (query.country) rows = rows.filter(h => h.country === query.country);
    if (query.from) rows = rows.filter(h => h.holiday_date >= query.from);
    if (query.to) rows = rows.filter(h => h.holiday_date <= query.to);
    return { holidays: rows.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)) };
  }

  // ── LEAVE IMPACT (revenue lost to approved/pending leaves × employee's project rate) ──
  if (p === '/finance/leave-impact' && method === 'GET') {
    requireFinance();
    const from = query.from || null;
    const to = query.to || null;
    const userIndex = Object.fromEntries(store.users.map(u => [u.id, u]));
    const holidaySet = new Set(store.holidays.map(h => `${h.holiday_date}|${h.country}`));

    const isHoliday = (date, country) => holidaySet.has(`${date}|${country}`) || holidaySet.has(`${date}|GLOBAL`);
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);

    const items = [];
    let approvedLost = 0, pendingLost = 0, totalDays = 0;
    for (const lv of store.leaves) {
      if (!inRange(lv.start_date)) continue;
      if (lv.status !== 'approved' && lv.status !== 'pending') continue;
      const u = userIndex[lv.user_id];
      if (!u) continue;
      const rate = u.hourly_rate || 0;
      // Subtract weekend + holiday days from leave_days for true lost billable days.
      let billableDays = 0;
      const start = new Date(lv.start_date);
      const end = new Date(lv.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        // Use country mapping by employee ID prefix as a rough heuristic — D4US/CON = US, else IN.
        const country = (u.id.startsWith('D4US') || u.id.startsWith('CON')) ? 'US' : 'IN';
        if (isHoliday(iso, country)) continue;
        billableDays++;
      }
      const lost = billableDays * 8 * rate;
      const item = {
        leave_id: lv.id,
        user_id: lv.user_id,
        user_name: u.name,
        project: u.project,
        leave_type: lv.leave_type,
        start_date: lv.start_date,
        end_date: lv.end_date,
        billable_days: billableDays,
        rate,
        revenue_lost: lost,
        status: lv.status,
      };
      items.push(item);
      totalDays += billableDays;
      if (lv.status === 'approved') approvedLost += lost;
      else pendingLost += lost;
    }

    return {
      totals: { approved_lost: approvedLost, pending_lost: pendingLost, total_days: totalDays },
      items: items.sort((a, b) => b.revenue_lost - a.revenue_lost),
    };
  }

  // ── BILLABLE HOURS for an invoice draft (pulls timesheet entries × project rate for a period) ──
  if (p === '/finance/billable-hours' && method === 'GET') {
    requireFinance();
    const from = query.from, to = query.to;
    const clientId = query.client_id;
    if (!from || !to) throw new Error('from and to required');
    const rateByEmp = Object.fromEntries(store.users.map(u => [u.id, u.hourly_rate || 0]));

    const byProject = {};
    for (const ts of store.timesheets) {
      if (ts.status !== 'submitted' && ts.status !== 'saved') continue;
      const sowRate = rateByEmp[ts.user_id] || 0;
      for (const e of (ts.entries || [])) {
        if (!e.hours || !e.work_item) continue;
        if (e.date < from || e.date > to) continue;
        if (!byProject[e.work_item]) byProject[e.work_item] = { project_id: e.work_item, project_name: e.work_item, hours: 0, rate: 0, currency: 'USD', amount: 0 };
        byProject[e.work_item].hours += e.hours;
        byProject[e.work_item].amount += e.hours * sowRate;
      }
    }
    for (const proj of Object.values(byProject)) {
      if (proj.hours > 0) proj.rate = Math.round(proj.amount / proj.hours);
    }
    return { lines: Object.values(byProject) };
  }

  // ── CLIENT helpers ──
  function currentUser() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('demo-token-', '').replace('sb-token-', '') : null;
    return store.users.find(u => u.id === userId) || null;
  }
  function requireClient() {
    const u = currentUser();
    if (!u || u.role !== 'client') throw new Error('Forbidden');
    return u;
  }
  function clientOrInternal() {
    const u = currentUser();
    if (!u) throw new Error('Unauthorized');
    if (!['client', 'admin', 'finance'].includes(u.role)) throw new Error('Forbidden');
    return u;
  }

  // ── SOWs ──
  if (p === '/sows' && method === 'GET') {
    const u = clientOrInternal();
    let rows = clone(store.sows);
    // Client users can only see their own client's SOWs.
    if (u.role === 'client') rows = rows.filter(s => s.client_id === u.client_id);
    if (query.client_id) rows = rows.filter(s => s.client_id === query.client_id);
    if (query.status) rows = rows.filter(s => s.status === query.status);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return { sows: rows };
  }
  if (p.match(/^\/sows\/\d+$/) && method === 'GET') {
    const u = clientOrInternal();
    const id = parseInt(p.split('/')[2]);
    const sow = store.sows.find(s => s.id === id);
    if (!sow) throw new Error('SOW not found');
    if (u.role === 'client' && sow.client_id !== u.client_id) throw new Error('Forbidden');
    return { sow: clone(sow) };
  }
  if (p === '/sows' && method === 'POST') {
    const u = currentUser();
    if (!u || (u.role !== 'admin' && u.role !== 'finance')) throw new Error('Forbidden');
    const id = nextId.sows++;
    const number = body.sow_number || `SOW-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
    const sow = {
      id, sow_number: number, client_id: body.client_id, project_id: body.project_id || null,
      title: body.title, sow_type: body.sow_type || 'project', description: body.description || '',
      contract_value: Number(body.contract_value) || 0, currency: body.currency || 'USD',
      start_date: body.start_date || null, end_date: body.end_date || null,
      status: body.status || 'draft',
      resource_name: body.resource_name || null, resource_role: body.resource_role || null, resource_rate: body.resource_rate || null,
      finance_approved_by: null, finance_approved_at: null, finance_notes: null,
      manager_signed_by: null, manager_signed_at: null, docusign_envelope_id: null, docusign_status: null,
      rejected_by: null, rejected_at: null, rejection_reason: null,
      created_by: u.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.sows.push(sow);
    return { sow: clone(sow) };
  }
  if (p.match(/^\/sows\/\d+$/) && method === 'PUT') {
    const u = clientOrInternal();
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    if (u.role === 'client' && store.sows[idx].client_id !== u.client_id) throw new Error('Forbidden');
    store.sows[idx] = { ...store.sows[idx], ...body, updated_at: new Date().toISOString() };
    return { sow: clone(store.sows[idx]) };
  }

  // ── SOW workflow transitions ──
  // Internal: submit a draft SOW to client finance for approval
  if (p.match(/^\/sows\/\d+\/submit$/) && method === 'POST') {
    const u = currentUser();
    if (!u || (u.role !== 'admin' && u.role !== 'finance')) throw new Error('Forbidden');
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    store.sows[idx] = { ...store.sows[idx], status: 'submitted_for_finance', updated_at: new Date().toISOString() };
    return { sow: clone(store.sows[idx]) };
  }
  // Check approval status (mock: returns pending)
  if (p.match(/^\/sows\/\d+\/check-approval$/) && method === 'POST') {
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    return { status: store.sows[idx].status, message: 'Mock mode — no email check', emails_checked: 0 };
  }
  // Client finance: approve
  if (p.match(/^\/sows\/\d+\/finance-approve$/) && method === 'POST') {
    const u = requireClient();
    if (u.client_subrole !== 'finance') throw new Error('Only client finance can approve');
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    if (store.sows[idx].client_id !== u.client_id) throw new Error('Forbidden');
    store.sows[idx] = {
      ...store.sows[idx],
      status: 'finance_approved',
      finance_approved_by: u.id, finance_approved_at: new Date().toISOString(),
      finance_notes: body?.notes || store.sows[idx].finance_notes,
      updated_at: new Date().toISOString(),
    };
    return { sow: clone(store.sows[idx]) };
  }
  // Internal: send to DocuSign (mocked)
  if (p.match(/^\/sows\/\d+\/send-for-signature$/) && method === 'POST') {
    const u = currentUser();
    if (!u || (u.role !== 'admin' && u.role !== 'finance')) throw new Error('Forbidden');
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    const envId = body?.envelope_id || `DEMO-DS-${Math.floor(Math.random() * 9000 + 1000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9)}`;
    store.sows[idx] = {
      ...store.sows[idx],
      status: 'sent_for_signature',
      docusign_envelope_id: envId, docusign_status: 'sent',
      updated_at: new Date().toISOString(),
    };
    return { sow: clone(store.sows[idx]) };
  }
  // Client manager: sign (mocked DocuSign completion)
  if (p.match(/^\/sows\/\d+\/sign$/) && method === 'POST') {
    const u = requireClient();
    if (u.client_subrole !== 'manager') throw new Error('Only client manager can sign');
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    if (store.sows[idx].client_id !== u.client_id) throw new Error('Forbidden');
    store.sows[idx] = {
      ...store.sows[idx],
      status: 'signed',
      manager_signed_by: u.id, manager_signed_at: new Date().toISOString(),
      docusign_status: 'completed',
      updated_at: new Date().toISOString(),
    };
    return { sow: clone(store.sows[idx]) };
  }
  // Internal: activate (project starts)
  if (p.match(/^\/sows\/\d+\/activate$/) && method === 'POST') {
    const u = currentUser();
    if (!u || (u.role !== 'admin' && u.role !== 'finance')) throw new Error('Forbidden');
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    store.sows[idx] = { ...store.sows[idx], status: 'active', updated_at: new Date().toISOString() };
    return { sow: clone(store.sows[idx]) };
  }
  // Either client side or internal: reject
  if (p.match(/^\/sows\/\d+\/reject$/) && method === 'POST') {
    const u = clientOrInternal();
    const id = parseInt(p.split('/')[2]);
    const idx = store.sows.findIndex(s => s.id === id);
    if (idx < 0) throw new Error('SOW not found');
    if (u.role === 'client' && store.sows[idx].client_id !== u.client_id) throw new Error('Forbidden');
    store.sows[idx] = {
      ...store.sows[idx],
      status: 'rejected',
      rejected_by: u.id, rejected_at: new Date().toISOString(),
      rejection_reason: body?.reason || null,
      updated_at: new Date().toISOString(),
    };
    return { sow: clone(store.sows[idx]) };
  }

  // ── CLIENT TIMESHEETS (manager approval) ──
  if (p === '/client/timesheets' && method === 'GET') {
    const u = requireClient();
    // Return submitted timesheets where the user_project belongs to one of this client's billable projects.
    const myProjectNames = store.billableProjects.filter(bp => bp.client_id === u.client_id).map(bp => bp.name);
    const rows = store.timesheets
      .filter(t => t.status === 'submitted')
      .filter(t => myProjectNames.includes(t.user_project))
      .map(t => ({ ...t, total_hours: (t.entries || []).reduce((s, e) => s + (e.hours || 0), 0) }));
    return { timesheets: clone(rows) };
  }
  if (p.match(/^\/client\/timesheets\/\d+\/approve$/) && method === 'POST') {
    const u = requireClient();
    if (u.client_subrole !== 'manager') throw new Error('Only client manager can approve timesheets');
    const id = parseInt(p.split('/')[3]);
    const idx = store.timesheets.findIndex(t => t.id === id);
    if (idx < 0) throw new Error('Timesheet not found');
    const myProjectNames = store.billableProjects.filter(bp => bp.client_id === u.client_id).map(bp => bp.name);
    if (!myProjectNames.includes(store.timesheets[idx].user_project)) throw new Error('Forbidden');
    store.timesheets[idx] = {
      ...store.timesheets[idx],
      client_approval_status: 'approved',
      client_approved_by: u.id, client_approved_at: new Date().toISOString(),
      client_remarks: body?.remarks || null,
      updated_at: new Date().toISOString(),
    };
    return { success: true };
  }
  if (p.match(/^\/client\/timesheets\/\d+\/reject$/) && method === 'POST') {
    const u = requireClient();
    if (u.client_subrole !== 'manager') throw new Error('Only client manager can reject timesheets');
    const id = parseInt(p.split('/')[3]);
    const idx = store.timesheets.findIndex(t => t.id === id);
    if (idx < 0) throw new Error('Timesheet not found');
    store.timesheets[idx] = {
      ...store.timesheets[idx],
      client_approval_status: 'rejected',
      client_approved_by: u.id, client_approved_at: new Date().toISOString(),
      client_remarks: body?.remarks || null,
      updated_at: new Date().toISOString(),
    };
    return { success: true };
  }

  // ── CLIENT INVOICES (read scoped + record payment receipt) ──
  if (p === '/client/invoices' && method === 'GET') {
    const u = requireClient();
    let rows = clone(store.invoices).filter(i => i.client_id === u.client_id);
    rows.sort((a, b) => (b.issue_date || b.created_at || '').localeCompare(a.issue_date || a.created_at || ''));
    return { invoices: rows };
  }
  if (p.match(/^\/client\/invoices\/\d+\/manager-approve$/) && method === 'POST') {
    const u = requireClient();
    if (u.client_subrole !== 'manager') throw new Error('Only client manager can approve invoices');
    const id = parseInt(p.split('/')[3]);
    const idx = store.invoices.findIndex(i => i.id === id);
    if (idx < 0) throw new Error('Invoice not found');
    if (store.invoices[idx].client_id !== u.client_id) throw new Error('Forbidden');
    store.invoices[idx] = {
      ...store.invoices[idx],
      client_manager_approved_by: u.id, client_manager_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { invoice: clone(store.invoices[idx]) };
  }
  if (p.match(/^\/client\/invoices\/\d+\/record-payment$/) && method === 'POST') {
    const u = requireClient();
    if (u.client_subrole !== 'finance') throw new Error('Only client finance can record payment');
    const id = parseInt(p.split('/')[3]);
    const idx = store.invoices.findIndex(i => i.id === id);
    if (idx < 0) throw new Error('Invoice not found');
    if (store.invoices[idx].client_id !== u.client_id) throw new Error('Forbidden');
    store.invoices[idx] = {
      ...store.invoices[idx],
      status: 'paid',
      paid_at: store.invoices[idx].paid_at || new Date().toISOString(),
      payment_remittance_ref: body?.remittance_ref || null,
      payment_receipt_url: body?.receipt_url || null,
      updated_at: new Date().toISOString(),
    };
    return { invoice: clone(store.invoices[idx]) };
  }

  // ── CLIENT DASHBOARD (single payload with everything they care about) ──
  if (p === '/client/dashboard' && method === 'GET') {
    const u = requireClient();
    const myClientId = u.client_id;
    const client = store.clients.find(c => c.id === myClientId);
    const sowList = store.sows.filter(s => s.client_id === myClientId);
    const myProjectNames = store.billableProjects.filter(bp => bp.client_id === myClientId).map(bp => bp.name);
    const myProjects = store.billableProjects.filter(bp => bp.client_id === myClientId);
    const invoiceList = store.invoices.filter(i => i.client_id === myClientId);
    const tsList = store.timesheets.filter(t => t.status === 'submitted' && myProjectNames.includes(t.user_project));

    // Aggregated counts
    const sowStatus = {};
    for (const s of sowList) sowStatus[s.status] = (sowStatus[s.status] || 0) + 1;

    // Pending actions for THIS user (subrole-aware)
    const myActions = [];
    for (const s of sowList) {
      if (u.client_subrole === 'finance' && s.status === 'submitted_for_finance') {
        myActions.push({ kind: 'sow_finance_approve', sow_id: s.id, label: `Approve SOW ${s.sow_number}`, value: s.contract_value });
      }
      if (u.client_subrole === 'manager' && s.status === 'sent_for_signature') {
        myActions.push({ kind: 'sow_sign', sow_id: s.id, label: `Sign SOW ${s.sow_number}`, value: s.contract_value });
      }
    }
    if (u.client_subrole === 'manager') {
      for (const t of tsList) {
        if (!t.client_approval_status || t.client_approval_status === 'pending') {
          myActions.push({ kind: 'timesheet_approve', timesheet_id: t.id, label: `Approve timesheet · ${t.user_name} · ${t.period_label}` });
        }
      }
      for (const inv of invoiceList) {
        if (inv.status === 'sent' && !inv.client_manager_approved_at) {
          myActions.push({ kind: 'invoice_approve', invoice_id: inv.id, label: `Approve invoice ${inv.invoice_number}`, value: inv.total_amount });
        }
      }
    }
    if (u.client_subrole === 'finance') {
      for (const inv of invoiceList) {
        if (inv.status !== 'paid' && inv.status !== 'void') {
          myActions.push({ kind: 'invoice_pay', invoice_id: inv.id, label: `Record payment for ${inv.invoice_number}`, value: inv.total_amount });
        }
      }
    }

    // Billing rates view
    const billingRates = users.filter(u => u.hourly_rate && u.role === 'employee').map(e => ({ project: e.project || 'Unassigned', rate: e.hourly_rate, currency: 'USD', billing_type: 'hourly', employee_name: e.name, employee_id: e.id }));

    // Invoice totals
    const invoiceTotals = invoiceList.reduce((acc, i) => {
      const a = Number(i.total_amount) || 0;
      acc.total += a;
      if (i.status === 'paid') acc.paid += a;
      else if (i.status !== 'void') acc.outstanding += a;
      return acc;
    }, { total: 0, paid: 0, outstanding: 0 });

    return {
      client: client || null,
      user: { id: u.id, name: u.name, subrole: u.client_subrole },
      sow_status_counts: sowStatus,
      sows: clone(sowList).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10),
      pending_actions: myActions,
      billing_rates: billingRates,
      pending_timesheets: clone(tsList).map(t => ({ ...t, total_hours: (t.entries || []).reduce((s, e) => s + (e.hours || 0), 0) })),
      invoices: clone(invoiceList).sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '')).slice(0, 10),
      invoice_totals: invoiceTotals,
    };
  }

  // ── BENCH ANALYSIS (cross-references users × salary × recent hours) ──
  if (p === '/finance/bench-analysis' && method === 'GET') {
    requireFinance();
    // "Recent" window — default last 30 days from system date.
    const today = new Date();
    const cutoff = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);

    // Hours per user across recent submitted/saved entries.
    const hoursByUser = {};
    const lastEntryByUser = {};
    for (const ts of store.timesheets) {
      if (ts.status !== 'submitted' && ts.status !== 'saved') continue;
      for (const e of (ts.entries || [])) {
        if (!e.hours || !e.date) continue;
        if (e.date < cutoff) continue;
        hoursByUser[ts.user_id] = (hoursByUser[ts.user_id] || 0) + e.hours;
        if (!lastEntryByUser[ts.user_id] || e.date > lastEntryByUser[ts.user_id]) {
          lastEntryByUser[ts.user_id] = e.date;
        }
      }
    }

    // Salary lookup (annualized USD for sortable cost).
    const FX = { INR: 1 / 83, USD: 1, AED: 1 / 3.67 };
    const salaryByUser = {};
    for (const s of EMPLOYEE_SALARIES) {
      if (s.ctc_amount == null || !s.ctc_currency) continue;
      const fx = FX[s.ctc_currency] || 1;
      let usd = s.ctc_amount * fx;
      if (s.ctc_period === 'hourly') usd *= 2080;
      else if (s.ctc_period === 'monthly') usd *= 12;
      salaryByUser[s.id] = { annual_usd: usd, raw: s.ctc_raw };
    }

    const items = [];
    let totalBenchCost = 0;
    for (const u of store.users) {
      if (!u.is_active || u.role !== 'employee') continue;
      const recentHours = hoursByUser[u.id] || 0;
      const salary = salaryByUser[u.id] || { annual_usd: 0, raw: '—' };
      // Bench heuristic: < 40 hours in last 30 days OR explicit bench status.
      const onBench = recentHours < 40 || u.employee_status === 'bench';
      if (!onBench) continue;
      const monthlyCost = salary.annual_usd / 12;
      totalBenchCost += monthlyCost;
      items.push({
        user_id: u.id,
        user_name: u.name,
        project: u.project,
        designation: u.designation,
        recent_hours: recentHours,
        last_entry: lastEntryByUser[u.id] || null,
        annual_salary_usd: salary.annual_usd,
        monthly_cost_usd: monthlyCost,
        salary_raw: salary.raw,
        status: u.employee_status || 'bench',
      });
    }
    return {
      totals: { count: items.length, monthly_cost_usd: totalBenchCost, annual_cost_usd: totalBenchCost * 12 },
      items: items.sort((a, b) => b.monthly_cost_usd - a.monthly_cost_usd),
    };
  }

  // ── EMPLOYEE BILLING (per-employee revenue + per-project breakdown) ──
  if (p === '/finance/employee-billing' && method === 'GET') {
    requireFinance();
    const rateByProject = Object.fromEntries(store.billableProjects.map(bp => [bp.name, bp.bill_rate]));
    const rateByEmp = Object.fromEntries(store.users.map(u => [u.id, u.hourly_rate || 0]));
    const userIndex = Object.fromEntries(store.users.map(u => [u.id, u]));

    const byUser = {}; // user_id -> { user_id, user_name, project, hours, revenue, payout, by_project: {proj: {...}} }
    for (const ts of store.timesheets) {
      if (ts.status !== 'submitted' && ts.status !== 'saved') continue;
      for (const e of (ts.entries || [])) {
        if (!e.hours || !e.work_item) continue;
        const rate = rateByProject[e.work_item] || 0;
        const empRate = rateByEmp[ts.user_id] || 0;
        const revenue = e.hours * rate;
        const payout = e.hours * empRate;
        if (!byUser[ts.user_id]) {
          const u = userIndex[ts.user_id];
          byUser[ts.user_id] = {
            user_id: ts.user_id,
            user_name: u?.name || ts.user_name,
            project: u?.project || ts.user_project,
            hours: 0, revenue: 0, payout: 0,
            by_project: {},
          };
        }
        byUser[ts.user_id].hours += e.hours;
        byUser[ts.user_id].revenue += revenue;
        byUser[ts.user_id].payout += payout;
        if (!byUser[ts.user_id].by_project[e.work_item]) {
          byUser[ts.user_id].by_project[e.work_item] = { project: e.work_item, hours: 0, revenue: 0 };
        }
        byUser[ts.user_id].by_project[e.work_item].hours += e.hours;
        byUser[ts.user_id].by_project[e.work_item].revenue += revenue;
      }
    }
    return { items: Object.values(byUser).sort((a, b) => b.revenue - a.revenue) };
  }

  // ── EMPLOYEE SALARIES (admin + finance only — front-end gates the UI; mock layer just returns) ──
  if (p === '/employee-salaries' && method === 'GET') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vcc_token') : null;
    const userId = token ? token.replace('demo-token-', '').replace('sb-token-', '') : null;
    const user = store.users.find(u => u.id === userId);
    if (!user || (user.role !== 'admin' && user.role !== 'finance')) {
      throw new Error('Forbidden');
    }
    let rows = clone(EMPLOYEE_SALARIES);
    if (query.location) rows = rows.filter(r => r.location === query.location);
    return { salaries: rows };
  }

  console.warn('[MockAPI] Unhandled route:', method, path);
  return {};
}
