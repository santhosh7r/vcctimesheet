import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, DollarSign, Activity, BarChart3, CalendarOff, CalendarDays, FileSignature, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';

const REFRESH_MS = 30000;

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;
const fmtMoneyShort = (n) => {
  const v = Math.abs(n || 0);
  if (v >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n || 0)}`;
};

// Convert "VCC - Web B2B" → "VCC.WB" stock-ticker style.
function tickerSymbol(name) {
  const stripped = name.replace(/^VCC\s*-\s*/i, '');
  const words = stripped.split(/\s+|[-&/]/).filter(Boolean);
  let abbr = '';
  for (const w of words) {
    const c = w[0]?.toUpperCase();
    if (c && /[A-Z0-9]/.test(c)) abbr += c;
    if (abbr.length >= 3) break;
  }
  if (!abbr) abbr = stripped.slice(0, 3).toUpperCase();
  return `VCC.${abbr}`;
}

// Animated number that smoothly tweens to its target value.
function Ticker({ value, format = fmtMoney, className }) {
  const [display, setDisplay] = useState(value || 0);
  const fromRef = useRef(value || 0);
  const targetRef = useRef(value || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    fromRef.current = display;
    targetRef.current = value || 0;
    const start = performance.now();
    const dur = 800;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={`tabular-nums ${className || ''}`}>{format(display)}</span>;
}

function Sparkline({ points, color = '#fbbf24', width = 280, height = 48, fill = true }) {
  if (!points || points.length < 2) return <div style={{ width, height }} className="text-[10px] text-slate-300 flex items-center justify-center">—</div>;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  let path = '';
  for (let i = 0; i < points.length; i++) {
    const x = i * stepX;
    const y = height - ((points[i] - min) / range) * (height - 4) - 2;
    path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  const areaPath = fill ? `${path} L ${width} ${height} L 0 ${height} Z` : null;
  const lastX = (points.length - 1) * stepX;
  const lastY = height - ((points[points.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={areaPath} fill={`url(#spark-${color.replace('#', '')})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

function Delta({ pct, size = 'sm' }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = up ? 'text-emerald-500' : 'text-red-500';
  const sz = size === 'lg' ? 'text-[13px]' : 'text-[11px]';
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${color} ${sz}`}>
      <Icon size={size === 'lg' ? 13 : 11} strokeWidth={2.5} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// FlashCell briefly tints when its `change` prop differs between renders.
function FlashCell({ keyVal, change, children, className = '' }) {
  const prev = useRef(keyVal);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (prev.current !== keyVal) {
      const dir = change >= 0 ? 'up' : 'down';
      setFlash(dir);
      const t = setTimeout(() => setFlash(null), 800);
      prev.current = keyVal;
      return () => clearTimeout(t);
    }
  }, [keyVal, change]);
  const flashCls = flash === 'up' ? 'bg-emerald-500/10' : flash === 'down' ? 'bg-red-500/10' : '';
  return <span className={`${className} transition-colors duration-700 rounded-md px-1 ${flashCls}`}>{children}</span>;
}

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [leaveImpact, setLeaveImpact] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [error, setError] = useState('');

  const [sows, setSows] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invMonth, setInvMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
  });

  const tick = useCallback(() => {
    Promise.all([
      api.get('/finance/summary'),
      api.get('/finance/leave-impact').catch(() => ({ totals: { approved_lost: 0, pending_lost: 0 }, items: [] })),
      api.get('/holidays').catch(() => ({ holidays: [] })),
      api.get('/sows').catch(() => ({ sows: [] })),
      api.get('/invoices').catch(() => ({ invoices: [] })),
    ])
      .then(([s, li, h, sw, inv]) => {
        setSummary(prev => { setPrevSummary(prev); return s; });
        setLeaveImpact(li);
        setHolidays(h.holidays || []);
        setSows(sw.sows || []);
        setInvoices(inv.invoices || []);
        setLastTick(new Date());
        setCountdown(REFRESH_MS / 1000);
        setError('');
      })
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const sowBuckets = useMemo(() => ({
    pending_signature: sows.filter(s => s.status === 'sent_for_signature'),
    awaiting_finance: sows.filter(s => s.status === 'submitted_for_finance'),
    finance_approved: sows.filter(s => s.status === 'finance_approved'),
  }), [sows]);

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Month keys (YYYY-MM) that have invoices, most recent first.
  const invoiceMonths = useMemo(() => {
    const ms = new Set();
    for (const inv of invoices) {
      const d = inv.issue_date || inv.period_end;
      if (!d) continue;
      const dt = new Date(d);
      ms.add(`${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, '0')}`);
    }
    const now = new Date();
    ms.add(`${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`);
    return [...ms].sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  // Invoices in the selected month, with the month's total.
  const invoiceForMonth = useMemo(() => {
    const [yStr, mStr] = invMonth.split('-');
    const y = Number(yStr); const m = Number(mStr);
    const rows = [];
    let total = 0;
    for (const inv of invoices) {
      if (inv.status === 'void') continue;
      const d = inv.issue_date || inv.period_end;
      if (!d) continue;
      const dt = new Date(d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m) continue;
      const amt = Number(inv.total_amount) || 0;
      rows.push({ id: inv.id, invoice_number: inv.invoice_number, date: d, amount: amt });
      total += amt;
    }
    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { rows, total, label: `${MONTHS_SHORT[m]} ${y}` };
  }, [invoices, invMonth]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, REFRESH_MS);
    const cd = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => { clearInterval(id); clearInterval(cd); };
  }, [tick]);

  // Per-project trading-card data: latest day vs previous day
  const projectCards = useMemo(() => {
    if (!summary?.by_project_day) return [];
    return Object.entries(summary.by_project_day).map(([name, series]) => {
      const latest = series[series.length - 1] || { revenue: 0, hours: 0 };
      const prevDay = series[series.length - 2] || { revenue: 0, hours: 0 };
      const change = prevDay.revenue > 0 ? ((latest.revenue - prevDay.revenue) / prevDay.revenue) * 100 : (latest.revenue > 0 ? 100 : 0);
      const totalRevenue = (summary.by_project || []).find(p => p.project === name)?.revenue || 0;
      const totalHours = (summary.by_project || []).find(p => p.project === name)?.hours || 0;
      return {
        name,
        symbol: tickerSymbol(name),
        latestRevenue: latest.revenue,
        latestHours: latest.hours,
        change,
        sparkline: series.slice(-14).map(d => d.revenue),
        totalRevenue,
        totalHours,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [summary]);

  const topGainers = useMemo(() => projectCards.filter(p => p.change > 0).sort((a, b) => b.change - a.change).slice(0, 3), [projectCards]);
  const topLosers = useMemo(() => projectCards.filter(p => p.change < 0).sort((a, b) => a.change - b.change).slice(0, 3), [projectCards]);

  const todayHours = useMemo(() => {
    if (!summary?.by_day || summary.by_day.length === 0) return { latest: 0, prev: 0, change: 0 };
    const latest = summary.by_day[summary.by_day.length - 1] || { hours: 0 };
    const prev = summary.by_day[summary.by_day.length - 2] || { hours: 0 };
    const change = prev.hours > 0 ? ((latest.hours - prev.hours) / prev.hours) * 100 : 0;
    return { latest: latest.hours, prev: prev.hours, change, date: latest.date };
  }, [summary]);

  const sparkPoints = useMemo(() => (summary?.by_day || []).slice(-14).map(d => d.revenue), [summary]);

  const upcomingHolidays = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return holidays.filter(h => h.holiday_date >= today).slice(0, 4);
  }, [holidays]);

  const totals = summary?.totals || { hours: 0, revenue: 0, payout: 0, margin: 0, margin_pct: 0 };
  const prevTotals = prevSummary?.totals;
  const revenueDelta = prevTotals?.revenue > 0 ? ((totals.revenue - prevTotals.revenue) / prevTotals.revenue) * 100 : null;

  if (loading && !summary) {
    return (
      <>
        <PageHeader icon={LayoutDashboard} title="Finance Dashboard" subtitle="Loading market data…" />
        <div className="bg-white border border-slate-200/70 rounded-2xl p-12 text-center text-[13px] text-slate-400">Computing live revenue from logged hours…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Finance Dashboard"
        subtitle={`Welcome ${user?.name?.split(' ')[0] || ''} — live revenue, cost & margin`}
        actions={
          <div className="flex items-center gap-2">
            {lastTick && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-emerald-50 border border-emerald-200/50 text-[11px] font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                MARKET OPEN · next tick {countdown}s
              </span>
            )}
            <button onClick={tick} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCw size={12} strokeWidth={2} /> Refresh
            </button>
          </div>
        }
      />

      {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">{error}</div>}

      {/* SCROLLING TICKER TAPE */}
      {projectCards.length > 0 && (
        <div className="relative overflow-hidden bg-slate-900 rounded-xl mb-5 border border-slate-800">
          <div className="flex animate-[scroll_60s_linear_infinite] whitespace-nowrap py-2.5">
            {[...projectCards, ...projectCards].map((p, i) => (
              <span key={`${p.symbol}-${i}`} className="inline-flex items-center gap-2 px-5 text-[12px] font-semibold">
                <span className="text-amber-400 tracking-wide">{p.symbol}</span>
                <span className="text-white tabular-nums">{fmtMoney(p.totalRevenue)}</span>
                <span className={`tabular-nums ${p.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {p.change >= 0 ? '▲' : '▼'} {Math.abs(p.change).toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
          <style>{`
            @keyframes scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      )}

      {/* HERO REVENUE CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-gradient-to-br from-amber-500/20 to-orange-600/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-amber-400" strokeWidth={2} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Total Revenue · SOW rate × hours</span>
              </div>
              <FlashCell keyVal={totals.revenue} change={revenueDelta || 0}>
                <Ticker value={totals.revenue} className="text-[44px] font-bold tracking-[-0.025em]" />
              </FlashCell>
              {revenueDelta != null && <span className="ml-3"><Delta pct={revenueDelta} size="lg" /></span>}
              <div className="flex items-center gap-3 mt-1.5 text-[12px] text-white/50">
                <span>{Math.round(totals.hours).toLocaleString()} hours billed</span>
                <span>·</span>
                <span>Margin <span className="font-semibold text-emerald-300">{(totals.margin_pct || 0).toFixed(1)}%</span></span>
              </div>
            </div>
            <div className="hidden md:block">
              <Sparkline points={sparkPoints} color="#fbbf24" width={280} height={64} />
              <p className="text-[10px] text-white/40 mt-1 text-right">Last 14 days</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white border border-slate-200/70 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-emerald-600" strokeWidth={2} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Margin</span>
            </div>
            <Ticker value={totals.margin} className="text-[28px] font-bold text-slate-900 tracking-[-0.02em]" />
            <p className="text-[11px] text-slate-400 mt-1">Revenue − Payout = Margin ({totals.margin_pct}%)</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Payout</p>
              <p className="text-[15px] font-semibold text-red-600 tabular-nums">${Math.round(totals.payout).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Resources</p>
              <p className="text-[15px] font-semibold text-emerald-600 tabular-nums">{Object.keys(summary?.by_employee || {}).length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* GAINERS / LOSERS / VOLUME / LEAVE IMPACT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-emerald-200/40 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowUpRight size={12} className="text-emerald-600" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Top Gainers</span>
          </div>
          {topGainers.length > 0 ? (
            <div className="space-y-2">
              {topGainers.map(p => (
                <div key={p.symbol} className="flex items-center justify-between text-[12px]">
                  <span className="font-mono font-semibold text-slate-700">{p.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-slate-500">{fmtMoneyShort(p.totalRevenue)}</span>
                    <Delta pct={p.change} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-[11px] text-slate-300 italic py-2">No gainers</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-white border border-red-200/40 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowDownRight size={12} className="text-red-600" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Top Losers</span>
          </div>
          {topLosers.length > 0 ? (
            <div className="space-y-2">
              {topLosers.map(p => (
                <div key={p.symbol} className="flex items-center justify-between text-[12px]">
                  <span className="font-mono font-semibold text-slate-700">{p.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-slate-500">{fmtMoneyShort(p.totalRevenue)}</span>
                    <Delta pct={p.change} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-[11px] text-slate-300 italic py-2">All steady</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 size={12} className="text-slate-500" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Volume · latest day</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-slate-900 tabular-nums">{Math.round(todayHours.latest)}</span>
            <span className="text-[11px] text-slate-400">hours</span>
            <Delta pct={todayHours.change} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{todayHours.date || '—'} · prev {Math.round(todayHours.prev)}h</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarOff size={12} className="text-amber-700" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Lost to leaves</span>
          </div>
          <Ticker value={(leaveImpact?.totals?.approved_lost || 0)} className="text-[22px] font-bold text-amber-900 tracking-[-0.02em]" />
          <div className="flex items-center gap-2 mt-1 text-[10px] text-amber-700/80">
            <span>{leaveImpact?.totals?.total_days || 0} days</span>
            <span>·</span>
            <span>pending {fmtMoneyShort(leaveImpact?.totals?.pending_lost || 0)}</span>
          </div>
        </motion.div>
      </div>

      {/* SOWs + Vendor Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden lg:col-span-2">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={14} className="text-slate-500" strokeWidth={2} />
              <h3 className="text-[14px] font-semibold text-slate-800">SOW workflow inbox</h3>
            </div>
            <Link to="/admin/sow-workflow" className="text-[11px] font-semibold text-amber-700 hover:text-amber-800">Open SOW Workflow →</Link>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <Link to="/admin/sow-workflow" className="p-4 hover:bg-amber-50/40 transition-colors">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Awaiting Finance</p>
              <p className="text-[26px] font-bold text-amber-900 tabular-nums mt-1">{sowBuckets.awaiting_finance.length}</p>
              <p className="text-[10px] text-slate-400 mt-1">From delivery / vendors via email</p>
            </Link>
            <Link to="/admin/sow-workflow" className="p-4 hover:bg-blue-50/40 transition-colors">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Finance Approved</p>
              <p className="text-[26px] font-bold text-blue-900 tabular-nums mt-1">{sowBuckets.finance_approved.length}</p>
              <p className="text-[10px] text-slate-400 mt-1">Ready to send for signature</p>
            </Link>
            <Link to="/admin/sow-workflow" className="p-4 hover:bg-violet-50/40 transition-colors">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700 inline-flex items-center gap-1">
                <FileSignature size={10} strokeWidth={2.4} /> Pending signatures
              </p>
              <p className="text-[26px] font-bold text-violet-900 tabular-nums mt-1">{sowBuckets.pending_signature.length}</p>
              <p className="text-[10px] text-slate-400 mt-1">Signed via DocuSign email</p>
            </Link>
          </div>
          {sowBuckets.pending_signature.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">Most recent · awaiting signature</p>
              <div className="space-y-1.5">
                {sowBuckets.pending_signature.slice(0, 3).map(s => (
                  <Link key={s.id} to="/admin/sow-workflow" className="flex items-center justify-between text-[12px] hover:bg-slate-50/60 -mx-2 px-2 py-1 rounded-lg">
                    <div className="min-w-0">
                      <span className="font-mono text-slate-500 text-[11px]">{s.sow_number}</span>
                      <span className="font-medium text-slate-800 ml-2 truncate">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {s.vendor_name && <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 rounded">{s.vendor_name}</span>}
                      <span className="text-[11px] font-semibold tabular-nums text-slate-700">{fmtMoneyShort(s.contract_value)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-slate-500" strokeWidth={2} />
              <h3 className="text-[14px] font-semibold text-slate-800">Invoice revenue · by month</h3>
            </div>
            <select
              value={invMonth}
              onChange={(e) => setInvMonth(e.target.value)}
              className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-amber-500"
            >
              {invoiceMonths.map(key => {
                const [y, m] = key.split('-');
                return <option key={key} value={key}>{MONTHS_SHORT[Number(m)]} {y}</option>;
              })}
            </select>
          </div>
          <div className="px-5 py-2.5 border-b border-slate-100 flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Total invoiced · {invoiceForMonth.label}</span>
            <span className="text-[16px] font-bold text-slate-900 tabular-nums">{fmtMoney(invoiceForMonth.total)}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
            {invoiceForMonth.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-[12px] text-slate-400">No invoices for {invoiceForMonth.label}.</p>
            ) : invoiceForMonth.rows.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-slate-700 font-mono truncate">{r.invoice_number || '—'}</p>
                  <p className="text-[10px] text-slate-400">{r.date}</p>
                </div>
                <span className="text-[12px] font-semibold text-slate-700 tabular-nums ml-3 shrink-0">{fmtMoneyShort(r.amount)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* PROJECT TRADING CARDS GRID */}
      <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">Projects · Live ticker</h3>
          </div>
          <span className="text-[11px] text-slate-400">{projectCards.length} symbols · sorted by total revenue</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-slate-100">
          <AnimatePresence mode="popLayout">
            {projectCards.map(p => (
              <motion.div
                key={p.symbol}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-[12px] font-bold text-slate-900">{p.symbol}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[140px]" title={p.name}>{p.name.replace(/^VCC\s*-\s*/, '')}</p>
                  </div>
                  <Delta pct={p.change} />
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <FlashCell keyVal={p.totalRevenue} change={p.change}>
                    <span className="text-[16px] font-bold text-slate-900 tabular-nums">{fmtMoneyShort(p.totalRevenue)}</span>
                  </FlashCell>
                </div>
                <Sparkline points={p.sparkline} color={p.change >= 0 ? '#10b981' : '#ef4444'} width={160} height={28} fill={true} />
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                  <span>{Math.round(p.totalHours)}h total</span>
                  <span>last day {fmtMoneyShort(p.latestRevenue)}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* By Client + Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <DollarSign size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">By Client</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/40 border-b border-slate-100">
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Client</th>
                <th className="text-right font-semibold text-slate-500 px-4 py-2">Hours</th>
                <th className="text-right font-semibold text-slate-500 px-4 py-2">Revenue</th>
                <th className="text-right font-semibold text-slate-500 px-4 py-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_client || []).slice(0, 8).map(c => {
                const margin = c.revenue - c.payout;
                return (
                  <tr key={c.client_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{c.client_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{Math.round(c.hours)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmtMoneyShort(c.revenue)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoneyShort(margin)}</td>
                  </tr>
                );
              })}
              {(summary?.by_client || []).length === 0 && (
                <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400 text-[12px]">No billable hours logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">Upcoming Holidays</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingHolidays.length > 0 ? upcomingHolidays.map(h => (
              <div key={h.id} className="flex items-center justify-between px-5 py-2.5 text-[12px]">
                <div>
                  <p className="font-medium text-slate-800">{h.name}</p>
                  <p className="text-[10px] text-slate-400">{h.holiday_date} · {h.country === 'IN' ? '🇮🇳 India' : h.country === 'US' ? '🇺🇸 USA' : h.country}</p>
                </div>
                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">{h.country}</span>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-slate-400 text-[12px]">No upcoming holidays in the calendar.</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Leave impact details */}
      {leaveImpact?.items?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <CalendarOff size={14} className="text-amber-700" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">Revenue lost to leaves</h3>
            <span className="text-[11px] text-slate-400 ml-auto">weekends + holidays excluded</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/40 border-b border-slate-100">
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Employee</th>
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Project</th>
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Period</th>
                <th className="text-right font-semibold text-slate-500 px-4 py-2">Billable Days</th>
                <th className="text-right font-semibold text-slate-500 px-4 py-2">Revenue Lost</th>
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveImpact.items.slice(0, 8).map(it => (
                <tr key={it.leave_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-800">{it.user_name}</td>
                  <td className="px-4 py-2 text-slate-600 truncate max-w-[200px]" title={it.project}>{it.project || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{it.start_date} → {it.end_date}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{it.billable_days}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-700">{fmtMoneyShort(it.revenue_lost)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${it.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{it.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Revenue = SOW rate × hours. Payout = salary cost × hours. Margin = Revenue − Payout. Tickers refresh every 30s.
        Lost-leave revenue excludes weekends and country-matched public holidays.
      </p>
    </>
  );
}
