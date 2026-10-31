export function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.75} />}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
