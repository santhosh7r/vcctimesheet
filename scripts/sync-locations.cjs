const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Credentials come from the environment, never hardcoded:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_KEY=<key> node scripts/sync-locations.cjs
const { SUPABASE_URL, SUPABASE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_KEY must be set in the environment.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const wb = XLSX.readFile('VCC D4_APRIL_2026_Resources_List_Consolidated.xlsx');
const ws = wb.Sheets['D4_Resources'];
const rows = XLSX.utils.sheet_to_json(ws);

// Build name -> location map from xlsx
const xlsxMap = {};
rows.forEach(row => {
  const fullName = row['Full Name'] || '';
  const location = row['Onsite / Offshore - City Location & Country'] || '';
  const cleanName = fullName.replace(/\s*\(D4 Contractor\)\s*/i, '').trim();
  const type = location.toLowerCase().includes('onsite') ? 'onshore' : 'offshore';
  xlsxMap[cleanName.toLowerCase()] = { type, location, team: row['Project Team which they are working'] };
});

console.log('XLSX entries:', Object.keys(xlsxMap).length);

async function run() {
  const { data: users } = await sb.from('users').select('id, name');
  let matched = 0, unmatched = 0;
  const updates = [];

  for (const user of users) {
    const nameKey = user.name.toLowerCase().trim();
    let match = xlsxMap[nameKey];

    if (!match) {
      // Try partial matching
      for (const [key, val] of Object.entries(xlsxMap)) {
        if (key.includes(nameKey) || nameKey.includes(key)) {
          match = val;
          break;
        }
        // Try matching first name + last name parts
        const userParts = nameKey.split(' ');
        const xlsxParts = key.split(' ');
        if (userParts.length >= 2 && xlsxParts.length >= 2 &&
            userParts[0] === xlsxParts[0] &&
            (xlsxParts.includes(userParts[userParts.length - 1]) || userParts.includes(xlsxParts[xlsxParts.length - 1]))) {
          match = val;
          break;
        }
      }
    }

    if (match) {
      matched++;
      updates.push({ id: user.id, type: match.type, location: match.location });
      console.log('MATCH:', user.name, '->', match.type, '(' + match.location + ')');
    } else {
      unmatched++;
      console.log('NO MATCH:', user.id, user.name);
    }
  }

  console.log('\nMatched:', matched, 'Unmatched:', unmatched);

  // Update Supabase
  console.log('\nUpdating Supabase...');
  for (const u of updates) {
    const { error } = await sb.from('users')
      .update({ location_type: u.type })
      .eq('id', u.id);
    if (error) console.log('  ERROR updating', u.id, ':', error.message);
  }

  // Default unmatched to 'offshore' (most are India-based)
  const unmatchedIds = users.filter(u => !updates.find(up => up.id === u.id)).map(u => u.id);
  if (unmatchedIds.length > 0) {
    console.log('\nSetting', unmatchedIds.length, 'unmatched users to offshore by default');
    for (const id of unmatchedIds) {
      await sb.from('users').update({ location_type: 'offshore' }).eq('id', id);
    }
  }

  console.log('Done!');
}

run();
