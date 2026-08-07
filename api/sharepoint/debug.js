import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { graphFetch } from '../_lib/graph-client.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const SITE_ID = process.env.SHAREPOINT_SITE_ID;
  const LIST_ID = process.env.SHAREPOINT_LIST_ID;

  if (!SITE_ID || !LIST_ID) {
    return res.status(500).json({ error: 'SharePoint not configured' });
  }

  const searchName = (req.query.name || '').toLowerCase();
  const searchId = req.query.id || '';

  try {
    // Fetch all items
    let allItems = [];
    let nextUrl = `/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields&$top=200`;
    while (nextUrl) {
      const response = await graphFetch(nextUrl);
      allItems = allItems.concat(response.value || []);
      nextUrl = response['@odata.nextLink'] || null;
    }

    // If search params provided, filter to matching items
    if (searchName || searchId) {
      const matches = allItems.filter(item => {
        const f = item.fields || {};
        const title = (f.Title || '').toLowerCase();
        const empId = String(f.EmployeeID || '');
        const email = (f.Employeemailaddress || '').toLowerCase();

        if (searchId && empId === searchId) return true;
        if (searchName && (title.includes(searchName) || email.includes(searchName))) return true;
        return false;
      });

      const results = matches.map(item => {
        const f = item.fields || {};
        return {
          sharepoint_item_id: item.id,
          EmployeeID: f.EmployeeID,
          EmployeeID_type: typeof f.EmployeeID,
          Title: f.Title,
          Email: f.Employeemailaddress,
          Project: f.ProjectNames,
          Month: f.Month,
          Year: f.Year,
        };
      });

      // Also check Supabase user
      let supabaseUsers = [];
      if (searchId) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, name, email, project, is_active')
          .eq('id', searchId);
        supabaseUsers = data || [];
      }
      if (searchName && supabaseUsers.length === 0) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, name, email, project, is_active')
          .ilike('name', `%${searchName}%`);
        supabaseUsers = data || [];
      }

      return res.status(200).json({
        totalSharePointItems: allItems.length,
        matchesFound: results.length,
        matches: results,
        supabaseUsers,
      });
    }

    // Default: show first 10 items summary
    const report = allItems.slice(0, 10).map(item => {
      const f = item.fields || {};
      return {
        employee: `${f.Title} (${f.EmployeeID})`,
        month: f.Month,
        year: f.Year,
      };
    });

    return res.status(200).json({ totalItems: allItems.length, report });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
