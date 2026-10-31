export function StatusBadge({ status }) {
  const styles = {
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    processed: 'bg-amber-50 text-amber-800 ring-amber-600/15',
    cancelled: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  };
  const label = status ? status.replace('_', ' ') : 'unknown';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles[status] || 'bg-slate-50 text-slate-600 ring-slate-500/10'}`}>
      {label}
    </span>
  );
}
