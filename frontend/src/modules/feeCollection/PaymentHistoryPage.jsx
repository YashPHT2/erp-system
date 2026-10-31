import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { feeService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatDate, formatInr, modeLabel } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { FilterField, FilterPanel } from '../../components/FilterPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';

export function PaymentHistoryPage() {
  const { can, meta } = useAuth();
  usePageMeta('Payment history', 'Fee management');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load(page = 1) {
    setError('');
    try {
      setData(await feeService.listPayments({ page, search, paymentMode: mode, status }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    if (can('fees.read')) load(1);
  }, [can, search, mode, status]);

  if (!can('fees.read')) return <AccessDenied />;

  return (
    <div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <FilterPanel>
        <SearchBar value={search} onChange={setSearch} placeholder="Student, admission number, or receipt" />
        <FilterField label="Mode">
          <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="">All modes</option>
            {(meta?.paymentModes || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FilterField>
      </FilterPanel>
      <div className="card">
        <DataTable
          isLoading={!data}
          rows={data?.items || []}
          rowKey={(row) => row.id}
          emptyTitle="No payments"
          columns={[
            { key: 'receipt', header: 'Receipt', render: (row) => row.receiptId ? <Link className="font-medium text-indigo-700" to={`/fees/receipts/${row.receiptId}`}>{row.receiptNumber}</Link> : '—' },
            { key: 'student', header: 'Student', render: (row) => (
              <div>
                <p className="font-medium text-slate-900">{row.studentName}</p>
                <p className="text-xs text-slate-500">{row.admissionNumber}</p>
              </div>
            ) },
            { key: 'class', header: 'Class', render: (row) => row.section ? `${row.className} · ${row.section}` : row.className },
            { key: 'date', header: 'Date', render: (row) => formatDate(row.paymentDate) },
            { key: 'mode', header: 'Mode', render: (row) => modeLabel(row.paymentMode, meta?.paymentModes) },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
          ]}
        />
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={load} />
      </div>
    </div>
  );
}
