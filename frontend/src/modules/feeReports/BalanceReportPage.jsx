import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { reportService } from '../../services/financeService';
import { downloadCsv, getErrorMessage } from '../../services/api';
import { formatInr } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { FilterField, FilterPanel } from '../../components/FilterPanel';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';

export function BalanceReportPage({ title, group = 'Fee management', loader, exportPath, exportName, onlyDefaulters = false }) {
  const { can, meta } = useAuth();
  usePageMeta(title, group);
  const [search, setSearch] = useState('');
  const [className, setClassName] = useState('');
  const [year, setYear] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!can('reports.read')) return;
    let active = true;
    loader({ search, className, academicYear: year || undefined })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [can, search, className, year, loader]);

  if (!can('reports.read')) return <AccessDenied />;

  const classes = [...new Set((meta ? [] : []).concat([]))];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {data ? `${data.totals.withDues} students with dues · ${formatInr(data.totals.pendingAmount)} pending` : 'Balances are calculated from fee structures and active receipts.'}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => downloadCsv(exportPath, exportName, { search, className, academicYear: year || undefined }).catch((err) => setError(err.message))}
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <FilterPanel>
        <SearchBar value={search} onChange={setSearch} placeholder="Student or admission number" />
        <FilterField label="Class">
          <input className="input" value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Grade 10" list="class-options" />
          <datalist id="class-options">{classes.map((item) => <option key={item} value={item} />)}</datalist>
        </FilterField>
        <FilterField label="Academic year">
          <select className="input" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">Current year</option>
            {(meta?.academicYears || []).map((item) => <option key={item}>{item}</option>)}
          </select>
        </FilterField>
      </FilterPanel>
      <div className="card">
        <DataTable
          isLoading={!data}
          rows={data?.rows || []}
          rowKey={(row) => row.admissionNumber}
          emptyTitle={onlyDefaulters ? 'No defaulters' : 'No students'}
          emptyDescription={onlyDefaulters ? 'Every listed student is clear for this filter.' : 'Student records come from the student directory.'}
          columns={[
            { key: 'student', header: 'Student', render: (row) => (
              <div>
                <p className="font-medium text-slate-900">{row.studentName}</p>
                <p className="text-xs text-slate-500">{row.admissionNumber}</p>
              </div>
            ) },
            { key: 'class', header: 'Class', render: (row) => row.section ? `${row.className} · ${row.section}` : row.className },
            { key: 'total', header: 'Total', align: 'right', render: (row) => formatInr(row.totalAmount) },
            { key: 'paid', header: 'Paid', align: 'right', render: (row) => formatInr(row.paidAmount) },
            { key: 'pending', header: 'Pending', align: 'right', render: (row) => row.feeAssigned ? formatInr(row.pendingAmount) : 'No structure' },
          ]}
        />
      </div>
    </div>
  );
}
