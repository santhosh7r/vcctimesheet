import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export default function SortableHeader({ label, sortKey, currentSort, onSort, align = 'left' }) {
  const isActive = currentSort.key === sortKey;
  const dir = isActive ? currentSort.dir : null;

  return (
    <th
      onClick={() => {
        if (!isActive) onSort({ key: sortKey, dir: 'asc' });
        else if (dir === 'asc') onSort({ key: sortKey, dir: 'desc' });
        else onSort({ key: '', dir: 'asc' });
      }}
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none hover:text-slate-600 transition-colors group`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <span className="text-slate-300 group-hover:text-slate-400 transition-colors">
          {!isActive && <ChevronsUpDown size={12} />}
          {isActive && dir === 'asc' && <ChevronUp size={12} className="text-primary-500" />}
          {isActive && dir === 'desc' && <ChevronDown size={12} className="text-primary-500" />}
        </span>
      </span>
    </th>
  );
}

export function sortData(data, sort, getters = {}) {
  if (!sort.key) return data;
  const getter = getters[sort.key] || ((item) => {
    const val = item[sort.key];
    return typeof val === 'string' ? val.toLowerCase() : val ?? '';
  });
  return [...data].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
}
