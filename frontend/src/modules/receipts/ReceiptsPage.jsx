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
import { ConfirmationDialog } from '../../components/ConfirmationDialog';

export function ReceiptsPage() {
  const { can, meta } = useAuth();
  usePageMeta('Receipts', 'Fee management');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(page = 1) {
    setError('');
    try {
      setData(await feeService.listReceipts({ page, search, paymentMode: mode, status, from, to }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    if (can('fees.read')) load(1);
  }, [can, search, mode, status, from, to]);

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await feeService.cancelReceipt(target.id, reason);
      setTarget(null);
      setReason('');
      await load(data?.page || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!can('fees.read')) return <AccessDenied />;

  return (
    <div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <FilterPanel>
        <SearchBar value={search} onChange={setSearch} placeholder="Receipt, student, or admission number" />
        <FilterField label="From"><input type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className="input" value={to} onChange={(event) => setTo(event.target.value)} /></FilterField>
        <FilterField label="Mode">
          <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="">All</option>
            {(meta?.paymentModes || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FilterField>
      </FilterPanel>
      <div className="card">
        <DataTable
          isLoading={!data}
          rows={data?.items || []}
          rowKey={(row) => row.id}
          emptyTitle="No receipts"
          columns={[
            { key: 'number', header: 'Receipt', render: (row) => <Link className="font-medium text-blue-700" to={`/fees/receipts/${row.id}`}>{row.receiptNumber}</Link> },
            { key: 'student', header: 'Student', render: (row) => row.studentName },
            { key: 'date', header: 'Date', render: (row) => formatDate(row.paymentDate) },
            { key: 'mode', header: 'Mode', render: (row) => modeLabel(row.paymentMode, meta?.paymentModes) },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
            { key: 'action', header: '', render: (row) => row.status === 'active' && can('receipts.cancel') ? (
              <button type="button" className="btn-danger h-8" onClick={() => { setTarget(row); setReason(''); }}>Cancel</button>
            ) : null },
          ]}
        />
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={load} />
      </div>
      <ConfirmationDialog
        open={Boolean(target)}
        title="Cancel receipt"
        confirmLabel="Cancel receipt"
        tone="danger"
        isBusy={busy}
        onClose={() => setTarget(null)}
        onConfirm={cancel}
      >
        <p>Receipt {target?.receiptNumber} will stay in the audit history. The payment will be reversed on the student balance.</p>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Reason</span>
          <textarea className="input h-24 py-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this receipt being cancelled?" />
        </label>
      </ConfirmationDialog>
    </div>
  );
}
