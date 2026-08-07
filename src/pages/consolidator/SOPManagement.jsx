import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileSignature, Download, DollarSign, Users, Search, ChevronDown, ChevronUp, Filter, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { supabase, useSupabase, api, getFileUrl } from '../../lib/api';

// ── Fallback data (used when Supabase is unavailable) ──
const FALLBACK_DATA = [
  { name: "Hari Chandana", project: "Salesforce - Zendesk previous", manager: "Miti Desai", location: "Offshore", rate: 30, status: "Active", sow_number: "202301001", comments: "" },
  { name: "Karthiga Adhimoolam", project: "Salesforce - Zendesk previous", manager: "Miti Desai", location: "Offshore", rate: 30, status: "Active", sow_number: "202301001", comments: "" },
  { name: "Tilak G", project: "IT Infra - Help Desk", manager: "James Petrokus", location: "Offshore", rate: 30, status: "Exit", sow_number: "202404002", comments: "Not part of the team from March 2026" },
  { name: "Senthilnathan Rajagopal", project: "IT Infra - Help Desk", manager: "James Petrokus", location: "Offshore", rate: 30, status: "Active", sow_number: "202404002", comments: "" },
  { name: "Vivekanandan J", project: "IT Infra - Help Desk", manager: "James Petrokus", location: "Offshore", rate: 30, status: "Active", sow_number: "202404002", comments: "" },
  { name: "Akhila Reddy", project: "IT Infra - Help Desk-Savanah", manager: "Victoria Yates", location: "Onsite", rate: 95, status: "Active", sow_number: "202511001", comments: "New SOW to be created" },
  { name: "Anand Suchak", project: "eComm - Tiger Ops", manager: "Ron Gliane", location: "Onsite", rate: 80, status: "Active", sow_number: "202509001", comments: "" },
  { name: "Janani Ramkumar", project: "IT Infra PMO", manager: "James Petrokus", location: "Offshore", rate: 37, status: "Active", sow_number: "202406001", comments: "" },
  { name: "Aldrin Shaji", project: "IT Infra 8x8 Contact Center", manager: "James Petrokus", location: "Offshore", rate: 37, status: "Active", sow_number: "202509002", comments: "" },
  { name: "Mohammed Abdullah Khan", project: "IT Infrastructure and Security", manager: "James Petrokus", location: "Offshore", rate: 32, status: "Active", sow_number: "202507001", comments: "" },
  { name: "Karthikeyan Vijayan", project: "IT Infrastructure and Security", manager: "James Petrokus", location: "Offshore", rate: 35, status: "Active", sow_number: "202507001", comments: "" },
  { name: "Dhiraj Gurung", project: "IT Infra Help Desk-Savanah", manager: "Victoria Yates", location: "Onsite", rate: 65, status: "Active", sow_number: "202504003", comments: "" },
  { name: "Mark Soliz", project: "IT Infra Help Desk - Onsite", manager: "James Petrokus", location: "Onsite", rate: 85, status: "Active", sow_number: "202404002", comments: "Draft send not signed" },
  { name: "Pratik Parmar", project: "DataMart Project PMO", manager: "Rahul Agarwal", location: "Onsite", rate: 85, status: "Active", sow_number: "202402005", comments: "" },
  { name: "Thomas Bruttell", project: "JDE - Onsite", manager: "Bryan Brewer", location: "Onsite", rate: 110, status: "Active", sow_number: "202512001", comments: "" },
  { name: "Rafi Ghafoor", project: "D365 Integration-Onsite", manager: "Andrew Pfister", location: "Onsite", rate: 90, status: "Active", sow_number: "202501001", comments: "Rate increased to $90" },
  { name: "Pothi Raja", project: "D365 Integration-Offshore", manager: "Andrew Pfister", location: "Offshore", rate: 32, status: "Active", sow_number: "202501001", comments: "" },
  { name: "Krupa Vyas", project: "D365 F&O", manager: "Matt Forsyth", location: "Onsite", rate: 38, status: "Active", sow_number: "202401004", comments: "" },
  { name: "B N Reddy", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 32, status: "Active", sow_number: "202411001", comments: "" },
  { name: "Srinivasan Pandiaraj", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 39, status: "Active", sow_number: "202502003", comments: "" },
  { name: "Shahul Hameed", project: "QA - D365 F&O", manager: "Kene Nwobu", location: "Offshore", rate: 30, status: "Active", sow_number: "202502003", comments: "" },
  { name: "Meenalochini B", project: "QA - D365 F&O", manager: "Kene Nwobu", location: "Offshore", rate: 30, status: "Active", sow_number: "202502003", comments: "" },
  { name: "Anant Moger", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 32, status: "Active", sow_number: "202411001", comments: "" },
  { name: "Kishore Babu Jyothi", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 39, status: "Active", sow_number: "202502003", comments: "" },
  { name: "Sankar Raman", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 39, status: "Active", sow_number: "202507005", comments: "" },
  { name: "Manish Kumar Dayma", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 43, status: "Active", sow_number: "202507005", comments: "" },
  { name: "Thangaraj Aran", project: "D365 F&O - Payment Processor", manager: "Matt Forsyth", location: "Offshore", rate: 0, status: "Active", sow_number: "202511003", comments: "Fixed Bid" },
  { name: "Muthu Krishnan", project: "QA - Partner Insight", manager: "Kene Nwobu", location: "Offshore", rate: 32, status: "Active", sow_number: "202502001", comments: "" },
  { name: "Mahesh Marimuthu", project: "Partner Insight", manager: "Ron Gliane", location: "Offshore", rate: 37, status: "Active", sow_number: "202502001", comments: "" },
  { name: "Gayathri M", project: "Partner Insight", manager: "Ron Gliane", location: "Offshore", rate: 33, status: "Active", sow_number: "202502001", comments: "" },
  { name: "Sasikumar Saravanan", project: "Partner Insight", manager: "Ron Gliane", location: "Offshore", rate: 33, status: "Active", sow_number: "202502001", comments: "" },
  { name: "Balaji Padmanaban", project: "Partner Insight", manager: "Ron Gliane", location: "Offshore", rate: 33, status: "Active", sow_number: "202502001", comments: "" },
  { name: "Kiran KalavaKollu", project: "Partner Insight", manager: "Ron Gliane", location: "Offshore", rate: 35, status: "Active", sow_number: "202502001", comments: "" },
  { name: "Ch.Nageswara Dhaveji", project: "Partner Insight", manager: "Ron Gliane", location: "Offshore", rate: 37, status: "Active", sow_number: "202508002", comments: "" },
  { name: "Sandhirasegaran Munisami", project: "Salesforce", manager: "Miti Desai", location: "Offshore", rate: 43, status: "Active", sow_number: "202506001", comments: "" },
  { name: "Divya Priya S", project: "Salesforce", manager: "Miti Desai", location: "Offshore", rate: 35, status: "Active", sow_number: "202506001", comments: "" },
  { name: "Mohammad Nawazudeen", project: "Salesforce", manager: "Miti Desai", location: "Offshore", rate: 35, status: "Active", sow_number: "202511004", comments: "" },
  { name: "Nishandhini Ashok Kumar", project: "Salesforce", manager: "Miti Desai", location: "Offshore", rate: 32, status: "Active", sow_number: "202511004", comments: "" },
  { name: "Swaminathan B N", project: "Salesforce", manager: "Miti Desai", location: "Offshore", rate: 35, status: "Active", sow_number: "202506001", comments: "" },
  { name: "Naveenkumar Venkatesan", project: "Salesforce", manager: "Miti Desai", location: "Offshore", rate: 30, status: "Active", sow_number: "202511004", comments: "" },
  { name: "Bindu Marella", project: "QA - Onsite", manager: "Kene Nwobu", location: "Onsite", rate: 95, status: "Active", sow_number: "202511002", comments: "" },
  { name: "K P Mohammed Arif", project: "QA - Performance", manager: "Kene Nwobu", location: "Offshore", rate: 33, status: "Active", sow_number: "202511005", comments: "" },
  { name: "Aruldoss A", project: "QA - eComm - Web B2B", manager: "Kene Nwobu", location: "Offshore", rate: 37, status: "Active", sow_number: "202509001", comments: "" },
  { name: "Jagadeesh Raju", project: "eComm - Web B2B", manager: "Ron Gliane", location: "Offshore", rate: 39, status: "Active", sow_number: "202509001", comments: "" },
  { name: "Sathishraj Raju", project: "eComm - Web B2B", manager: "Ron Gliane", location: "Offshore", rate: 39, status: "Active", sow_number: "202509001", comments: "" },
  { name: "Vimal David", project: "eComm - Web B2B", manager: "Ron Gliane", location: "Offshore", rate: 39, status: "Active", sow_number: "202509001", comments: "" },
  { name: "Zamir Vahora", project: "BA - eComm Onsite", manager: "Kene Nwobu", location: "Onsite", rate: 95, status: "Active", sow_number: "202510001", comments: "" },
  { name: "Chandan R Prajapati", project: "JDE Consultants", manager: "Bryan Brewer", location: "Offshore", rate: 37, status: "Active", sow_number: "202512002", comments: "" },
  { name: "Nitin Kumar Pal", project: "JDE Consultants", manager: "Bryan Brewer", location: "Offshore", rate: 37, status: "Active", sow_number: "202512002", comments: "" },
  { name: "Arul Kumaran Veerattan", project: "EDI Consultants", manager: "Bryan Brewer", location: "Offshore", rate: 37, status: "Active", sow_number: "202512002", comments: "" },
  { name: "Bholeshankar Pathak", project: "EDI Consultants", manager: "Bryan Brewer", location: "Offshore", rate: 37, status: "Active", sow_number: "202512002", comments: "" },
  { name: "Bradley Lacey", project: "D365 FO - Onsite", manager: "Matt Forsyth", location: "Onsite", rate: 85, status: "Active", sow_number: "202401004", comments: "" },
  { name: "Jenna Cox", project: "IT Infra - Incident Manager", manager: "James Petrokus", location: "Onsite", rate: 85, status: "Active", sow_number: "202601002", comments: "" },
  { name: "Javal Vadera", project: "IT Infra - Finance Assistant", manager: "James Petrokus", location: "Onsite", rate: 60, status: "Active", sow_number: "202601001", comments: "" },
  { name: "Humera Ahmed", project: "Partner Insight - .NET Onsite", manager: "Ron Gliane", location: "Onsite", rate: 85, status: "Active", sow_number: "202601004", comments: "SOW to be reviewed and signed" },
  { name: "Ganesh Jayaraman", project: "QA - Integration", manager: "Kene Nwobu", location: "Offshore", rate: 35, status: "Active", sow_number: "202602003", comments: "SOW to be reviewed and signed" },
  { name: "Manjari", project: "QA - D365 F&O", manager: "Kene Nwobu", location: "Offshore", rate: 33, status: "Active", sow_number: "202602003", comments: "SOW to be reviewed and signed" },
  { name: "Saritha Thota", project: "QA - Tech Lead Onsite", manager: "Kene Nwobu", location: "Onsite", rate: 85, status: "Active", sow_number: "202602003", comments: "SOW to be reviewed and signed" },
  { name: "Aravindh Perumal", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 37, status: "Active", sow_number: "202502003", comments: "Functional Consultant" },
  { name: "Abhinandhan Poorlin", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 35, status: "Active", sow_number: "202502003", comments: "Replacement to Santhosh" },
  { name: "Andrea Solorzano", project: "D365 F&O - Onsite", manager: "Matt Forsyth", location: "Onsite", rate: 0, status: "Active", sow_number: "", comments: "SOW to be created" },
  { name: "Keerthivasan", project: "D365 F&O", manager: "Matt Forsyth", location: "Offshore", rate: 37, status: "Active", sow_number: "202507005", comments: "Replacement to Krishnakumar" },
  { name: "Bhavesh Pandya", project: "QA", manager: "Kene Nwobu", location: "Offshore", rate: 35, status: "Active", sow_number: "202602003", comments: "New" },
  { name: "Irfan Mukhtar", project: "EDI - Onsite", manager: "Bryan Brewer", location: "Onsite", rate: 0, status: "Active", sow_number: "", comments: "New Onsite EDI" },
  { name: "Madhavi Ummalanani", project: "QA eComm - Onsite", manager: "Kene Nwobu", location: "Onsite", rate: 0, status: "Active", sow_number: "202602003", comments: "New Onsite QA" },
  { name: "Ashwath", project: "QA eComm", manager: "Kene Nwobu", location: "Offshore", rate: 0, status: "Active", sow_number: "202502003", comments: "" },
];

// SOW file mapping (from OneDrive folder)
const SOW_FILES = {
  "202301001": "SOW_202301001_D4_VCC_ZenDesk.pdf",
  "202401004": "SOW_202401004_D365_Krupa_Onsite_VCC_D4.pdf",
  "202404002": "SOW_202404002_ITAdminOnsiteOffshore.pdf",
  "202406001": "SOW_202406001_VCC_D4_PMO_Janani.pdf",
  "202501001": "SOW_202501001_IntegrationOnsiteOffshore.pdf",
  "202502001": "SOW_VCC_D4_202502001_PartnerInsight.docx.pdf",
  "202502003": "VCC_D4_SOW_202502003_D365FOTeam.docx.pdf",
  "202506001": "SOW_202506001_SalesforceCRM_VCC_D4_.docx.pdf",
  "202507001": "VCC_D4_SOW_202507001_InfraSecurityTeam.docx.pdf",
  "202507005": "VCC_D4_SOW_202507005_D365FO_Addon.docx.pdf",
  "202508002": "SOW_VCC_D4_202508002_PartnerInsight_AddOn.docx.pdf",
  "202504003": "",
  "202509001": "VCC_D4_SOW_202509001_eCommercePod.docx.pdf",
  "202510001": "",
  "202509002": "VCC_D4_SOW_202509002_8x8.docx.pdf",
  "202511001": "SOW_202511001_ITServices_Savannah_Akhila.docx.pdf",
  "202511002": "SOW_202511002_QAManager_Bindu.docx.pdf",
  "202511003": "Fixed_Bid_SOW_D365_Payment_Connector.docx.pdf",
  "202511004": "VCC_D4_SOW_202511004_SalesforceCRMAddOn.docx.pdf",
  "202511005": "SOW_202511005_PerformanceTesting.docx.pdf",
  "202512001": "SOW_202512001_JDE_OnsiteConsultant.docx.pdf",
  "202512002": "SOW_202512002_JDE_EDI_Consultants.docx.pdf",
  "202601001": "SOW_202601001_OnsiteFinanceAnalyst.docx.pdf",
  "202601002": "SOW_202601002_OnsiteIncidentManager.docx.pdf",
  "202601004": "VCC_D4_SOW_202601004_Humera_OnsiteDotNetDevdocx.pdf",
  "202602003": "VCC_D4_SOW_202602003_QATeam.docx.pdf",
  "202604002": "VCC_D4_SOW_202604002_QA_eComm_Onsite.docx.pdf",
};

const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500";

export default function SOPManagement({ clientView = false }) {
  const navigate = useNavigate();
  const [sowData, setSowData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterManager, setFilterManager] = useState('all');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedSow, setExpandedSow] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  // SOWs from the sows table (uploaded via User Management or created via SOW Workflow).
  const [sowsFromTable, setSowsFromTable] = useState([]);

  // Load from Supabase
  const loadData = async () => {
    setLoading(true);
    if (useSupabase && supabase) {
      try {
        const { data } = await supabase.from('sow_resources').select('*').order('name');
        if (data && data.length > 0) {
          setSowData(data.map(r => ({
            ...r,
            rate: Number(r.rate) || 0,
            sow_number: r.sow_number || '',
            sow_file: r.sow_file || SOW_FILES[r.sow_number] || '',
          })));
        }
        // Load all users for comparison
        const userData = await api.get('/users?include_all=true');
        setAllUsers((userData.users || []).filter(u => u.id !== 'ADM001'));
        // Load SOWs from the sows table so user-uploaded SOWs appear here.
        try {
          const sowResp = await api.get('/sows');
          setSowsFromTable(sowResp.sows || []);
        } catch (e) {
          console.warn('Could not load /sows:', e?.message);
        }
      } catch (err) {
        console.error('Failed to load SOW data:', err);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Computed stats
  const activeResources = useMemo(() =>
    sowData.filter(r => r.status === 'Active'), [sowData]);

  const totalBilled = useMemo(() =>
    activeResources.reduce((sum, r) => sum + (r.rate || 0), 0), [activeResources]);

  const managers = useMemo(() =>
    [...new Set(sowData.map(r => r.manager).filter(Boolean))].sort(), [sowData]);

  // Total active employees from users table (same as admin dashboard)
  const activeEmployees = useMemo(() =>
    allUsers.filter(u => u.is_active !== false), [allUsers]);

  const totalEmployees = activeEmployees.length;

  // Billable = active SOW resources with a SOW number linked
  const billableResources = useMemo(() =>
    activeResources.filter(r => r.sow_number && r.sow_number !== 'No SOW'), [activeResources]);

  // Non-billable = active SOW resources missing SOW
  const missingSow = useMemo(() =>
    activeResources.filter(r => !r.sow_number || r.sow_number === 'No SOW'), [activeResources]);

  // Offshore / Onsite from SOW resources
  const totalOnsite = useMemo(() =>
    activeResources.filter(r => r.location === 'Onsite').length, [activeResources]);

  const totalOffshore = useMemo(() =>
    activeResources.filter(r => r.location === 'Offshore').length, [activeResources]);

  // Lookup of uploaded files / DB SOWs keyed by sow_number.
  const sowsByNumber = useMemo(() => {
    const map = {};
    for (const s of sowsFromTable) {
      if (s.sow_number) map[s.sow_number] = s;
    }
    return map;
  }, [sowsFromTable]);

  // SOW grouping — merge three sources into one accordion:
  //   1. sow_resources table (legacy roster data)
  //   2. users table (anyone with sow_number set via User Management)
  //   3. sows table (uploaded files from User Management or drafts with files)
  const sowGroups = useMemo(() => {
    const groups = {};

    const ensureGroup = (key) => {
      if (groups[key]) return groups[key];
      const dbSow = sowsByNumber[key];
      groups[key] = {
        sow_number: key,
        resources: [],
        totalRate: 0,
        file: dbSow?.file_url || SOW_FILES[key] || null,
        file_name: dbSow?.file_name || null,
        uploaded: !!dbSow?.file_url,
      };
      return groups[key];
    };

    // 1. sow_resources roster
    for (const r of sowData) {
      const key = r.sow_number || 'No SOW';
      const g = ensureGroup(key);
      // Preserve the legacy static file fallback when no DB upload exists.
      if (!g.file && r.sow_file) g.file = r.sow_file;
      g.resources.push(r);
      g.totalRate += r.rate || 0;
    }

    // 2. Surface DB SOWs that have a file (uploaded via User Management).
    //    The user/resource info is on the SOW row itself (resource_name/role/rate)
    //    because the users table doesn't store sow_number — the upload writes
    //    those fields straight onto the SOW row through /sows/attach-file.
    for (const s of sowsFromTable) {
      const key = s.sow_number;
      if (!key || !s.file_url) continue;
      const g = ensureGroup(key);
      g.file = s.file_url;
      g.file_name = s.file_name || g.file_name;
      g.uploaded = true;
      if (s.resource_name) {
        const dup = g.resources.some(r => (r.name || '').toLowerCase() === s.resource_name.toLowerCase());
        if (!dup) {
          const rate = Number(s.resource_rate) || 0;
          g.resources.push({
            name: s.resource_name,
            project: s.title || '',
            manager: '',
            location: 'Offshore',
            rate,
            status: 'Active',
            sow_number: key,
            comments: s.resource_role || '',
            from_sow: true,
          });
          g.totalRate += rate;
        }
      }
    }

    return Object.values(groups).sort((a, b) => b.sow_number.localeCompare(a.sow_number));
  }, [sowData, sowsFromTable, sowsByNumber]);

  // Signed-URL opener for uploaded SOW files (the 'documents' bucket is private).
  const openSowFile = async (group, e) => {
    if (e) e.stopPropagation();
    if (!group.file) return;
    if (group.uploaded) {
      const signed = await getFileUrl(group.file);
      if (signed) window.open(signed, '_blank', 'noopener');
    } else {
      window.open(`/sow-files/${group.file}`, '_blank', 'noopener');
    }
  };

  // Filtered and sorted resources
  const filtered = useMemo(() => {
    let data = [...sowData];
    if (filterStatus !== 'all') data = data.filter(r => r.status === filterStatus);
    if (filterManager !== 'all') data = data.filter(r => r.manager === filterManager);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.project.toLowerCase().includes(q) ||
        r.sow_number.includes(q)
      );
    }
    data.sort((a, b) => {
      let va = a[sortField] || '', vb = b[sortField] || '';
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return data;
  }, [search, filterManager, filterStatus, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const rateColor = (rate) => {
    if (rate >= 85) return 'text-emerald-700 bg-emerald-50';
    if (rate >= 35) return 'text-primary-700 bg-primary-50';
    if (rate > 0) return 'text-amber-700 bg-amber-50';
    return 'text-slate-400 bg-slate-50';
  };

  return (
    <div>
      <PageHeader
        icon={FileSignature}
        title="SOW Management"
        subtitle="Statement of Work tracking, resource mapping & document generation"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Users size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-[22px] font-bold text-slate-900 leading-none">{sowData.length}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Total Resources</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 px-3 py-2 bg-emerald-50 rounded-xl">
              <p className="text-[16px] font-bold text-emerald-700">{activeResources.length}</p>
              <p className="text-[10px] text-emerald-600 font-medium">Active</p>
            </div>
            <div className="flex-1 px-3 py-2 bg-red-50 rounded-xl">
              <p className="text-[16px] font-bold text-red-600">{sowData.length - activeResources.length}</p>
              <p className="text-[10px] text-red-500 font-medium">Inactive / Exit</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <CheckCircle size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Billing Breakdown</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 px-3 py-2 bg-emerald-50 rounded-xl">
              <p className="text-[16px] font-bold text-emerald-700">{billableResources.length}</p>
              <p className="text-[10px] text-emerald-600 font-medium">Billable</p>
            </div>
            <div className="flex-1 px-3 py-2 bg-amber-50 rounded-xl">
              <p className="text-[16px] font-bold text-amber-700">{missingSow.length}</p>
              <p className="text-[10px] text-amber-600 font-medium">Non-Billable</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
              <DollarSign size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[22px] font-bold text-slate-900 leading-none">${totalBilled.toLocaleString()}<span className="text-[13px] font-medium text-slate-400">/hr</span></p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Total Hourly Rate</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 px-3 py-2 bg-sky-50 rounded-xl">
              <p className="text-[16px] font-bold text-sky-700">{totalOffshore}</p>
              <p className="text-[10px] text-sky-600 font-medium">Offshore</p>
            </div>
            <div className="flex-1 px-3 py-2 bg-purple-50 rounded-xl">
              <p className="text-[16px] font-bold text-purple-700">{totalOnsite}</p>
              <p className="text-[10px] text-purple-600 font-medium">Onsite</p>
            </div>
          </div>
        </div>
      </div>

      {/* Missing SOW Alert */}
      {missingSow.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-800">{missingSow.length} Resource{missingSow.length !== 1 ? 's' : ''} Missing SOW</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingSow.map((r, i) => {
              // Match the SOW resource to a real user (so we can deep-link to their profile/edit).
              const match = allUsers.find(u => (u.name || '').trim().toLowerCase() === (r.name || '').trim().toLowerCase());
              const target = match
                ? `/admin/users?edit=${encodeURIComponent(match.id)}`
                : `/admin/users?q=${encodeURIComponent(r.name || '')}`;
              return (
                <button key={i} onClick={clientView ? undefined : () => navigate(target)}
                  disabled={clientView}
                  title={clientView ? r.project : (match ? `Open ${match.name}'s profile` : `Find ${r.name} in User Management`)}
                  className={`px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-medium text-amber-800 transition-colors ${clientView ? 'cursor-default' : 'hover:bg-amber-100 hover:border-amber-300 cursor-pointer'}`}>
                  {r.name} <span className="text-amber-500">({r.project})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SOW Groups (Accordion) */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">SOW Overview ({sowGroups.length} SOWs)</h3>
        <div className="space-y-2">
          {sowGroups.map((group) => {
            const isExpanded = expandedSow === group.sow_number;
            const activeCount = group.resources.filter(r => r.status === 'Active').length;
            return (
              <div key={group.sow_number} className="border border-slate-100 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSow(isExpanded ? null : group.sow_number)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-mono font-bold">
                      {group.sow_number}
                    </span>
                    <span className="text-sm text-slate-700">{activeCount} resource{activeCount !== 1 ? 's' : ''}</span>
                    {group.file && (
                      <button type="button" onClick={(e) => openSowFile(group, e)}
                        className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-medium hover:bg-emerald-100 transition-colors cursor-pointer">
                        View PDF
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-emerald-700 tabular-nums">${group.totalRate}/hr</span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="py-2 px-4 text-left font-medium text-slate-500">Resource</th>
                          <th className="py-2 px-4 text-left font-medium text-slate-500">Project</th>
                          <th className="py-2 px-4 text-left font-medium text-slate-500">Manager</th>
                          <th className="py-2 px-4 text-left font-medium text-slate-500">Location</th>
                          <th className="py-2 px-4 text-right font-medium text-slate-500">Rate</th>
                          <th className="py-2 px-4 text-left font-medium text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.resources.map((r, i) => (
                          <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                            <td className="py-2 px-4 font-medium text-slate-800">{r.name}</td>
                            <td className="py-2 px-4 text-slate-600">{r.project}</td>
                            <td className="py-2 px-4 text-slate-500">{r.manager}</td>
                            <td className="py-2 px-4">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.location === 'Onsite' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>
                                {r.location}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${rateColor(r.rate)}`}>
                                {r.rate > 0 ? `$${r.rate}` : '-'}
                              </span>
                            </td>
                            <td className="py-2 px-4">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {group.file && (
                      <button type="button" onClick={() => openSowFile(group)}
                        className="w-full text-left px-4 py-2 bg-slate-50 text-xs text-primary-600 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer">
                        <Download size={12} /> Open SOW Document: {group.file_name || group.file}
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Resource Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search resource, project, or SOW..." className="w-full pl-9 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
          </div>
          <select value={filterManager} onChange={e => setFilterManager(e.target.value)}
            className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
            <option value="all">All Managers</option>
            {managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Exit">Exit</option>
          </select>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Filter size={12} /> {filtered.length} of {sowData.length}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  { key: 'name', label: 'Resource Name' },
                  { key: 'project', label: 'Project/Program' },
                  { key: 'manager', label: 'VCC Manager' },
                  { key: 'location', label: 'Location' },
                  { key: 'rate', label: 'Rate ($/hr)' },
                  { key: 'sow_number', label: 'SOW #' },
                  { key: 'status', label: 'Status' },
                ].map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 select-none">
                    <span className="inline-flex items-center gap-1">{col.label} <SortIcon field={col.key} /></span>
                  </th>
                ))}
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                  className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 text-sm font-medium text-slate-900">{r.name}</td>
                  <td className="py-2.5 px-4 text-sm text-slate-600">{r.project}</td>
                  <td className="py-2.5 px-4 text-sm text-slate-500">{r.manager}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${r.location === 'Onsite' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>
                      {r.location}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${rateColor(r.rate)}`}>
                      {r.rate > 0 ? `$${r.rate}` : '-'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    {r.sow_number ? (
                      SOW_FILES[r.sow_number] ? (
                        <a href={`/sow-files/${SOW_FILES[r.sow_number]}`} target="_blank" rel="noopener noreferrer"
                          className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-mono font-bold hover:bg-primary-100 hover:underline transition-colors cursor-pointer">
                          {r.sow_number}
                        </a>
                      ) : (
                        <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-mono font-bold">{r.sow_number}</span>
                      )
                    ) : (
                      <span className="text-xs text-red-400 italic">Missing</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${r.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-400 max-w-[200px] truncate" title={r.comments}>{r.comments}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
