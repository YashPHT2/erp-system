export function EmptyState({ title, description, action }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
