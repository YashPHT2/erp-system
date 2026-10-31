export function FormInput({ label, error, hint, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input className={`input ${error ? 'input-error' : ''}`} {...props} />
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function FormSelect({ label, error, children, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <select className={`input ${error ? 'input-error' : ''}`} {...props}>{children}</select>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
