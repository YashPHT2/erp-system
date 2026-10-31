export function FilterPanel({ children }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}

export function FilterField({ label, children }) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
