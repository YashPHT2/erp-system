export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}
