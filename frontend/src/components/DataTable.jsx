export function DataTable({ columns, rows, rowKey, isLoading, emptyTitle, emptyDescription }) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-sm font-medium text-slate-800">{emptyTitle || 'Nothing to show'}</p>
        {emptyDescription && <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-2.5 font-medium ${column.align === 'right' ? 'text-right' : ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-50/80">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 text-slate-700 ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.className || ''}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
