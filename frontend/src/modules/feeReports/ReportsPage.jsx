import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { reportService } from '../../services/financeService';
import { downloadCsv, getErrorMessage } from '../../services/api';
import { formatDateTime, formatInr, modeLabel, todayIso } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { MonthlyBarChart, ModeChart } from '../../components/Charts';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { StatusBadge } from '../../components/StatusBadge';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'class', label: 'Class-wise' },
  { id: 'mode', label: 'Payment mode' },
  { id: 'pending', label: 'Pending' },
  { id: 'defaulters', label: 'Defaulters' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function ReportsPage() {
  const { can, meta } = useAuth();
  usePageMeta('Financial reports', 'Insights');
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'daily';
  const [date, setDate] = useState(todayIso());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!can('reports.read')) return undefined;
    let active = true;
    setData(null);
    setError('');
    const request = {
      daily: () => reportService.daily({ date }),
      monthly: () => reportService.monthly({ year }),
      class: () => reportService.classWise({ academicYear: meta?.academicYear }),
      mode: () => reportService.paymentModes({ year }),
      pending: () => reportService.pending({ academicYear: meta?.academicYear }),
      defaulters: () => reportService.defaulters({ academicYear: meta?.academicYear }),
      cancelled: () => reportService.cancelled(),
    }[tab];
    request()
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [can, tab, date, year, meta?.academicYear]);

  if (!can('reports.read')) return <AccessDenied />;

  function exportCurrent() {
    const paths = {
      daily: ['/reports/daily', 'daily-collection.csv', { date }],
      class: ['/reports/class-wise', 'class-wise-collection.csv', { academicYear: meta?.academicYear }],
      pending: ['/reports/pending', 'pending-fees.csv', { academicYear: meta?.academicYear }],
      defaulters: ['/reports/defaulters', 'defaulters.csv', { academicYear: meta?.academicYear }],
      cancelled: ['/reports/cancelled', 'cancelled-receipts.csv', {}],
    };
    const selected = paths[tab];
    if (!selected) return;
    downloadCsv(...selected).catch((err) => setError(err.message));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${tab === item.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setParams({ tab: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        {['daily', 'class', 'pending', 'defaulters', 'cancelled'].includes(tab) && (
          <button type="button" className="btn-secondary" onClick={exportCurrent}><Download className="h-4 w-4" /> Export</button>
        )}
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {tab === 'daily' && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-600">Total <span className="font-semibold text-slate-900">{formatInr(data?.totalAmount)}</span> · {data?.count || 0} payments</p>
            <input type="date" className="input w-auto" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <DataTable isLoading={!data && !error} rows={data?.rows || []} rowKey={(row) => row.id} emptyTitle="No collections on this date" columns={paymentColumns(meta)} />
        </div>
      )}

      {tab === 'monthly' && (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Collections by month</h2>
            <input className="input w-28" value={year} onChange={(event) => setYear(event.target.value)} />
          </div>
          <MonthlyBarChart data={data?.months || []} />
          <p className="mt-3 text-sm text-slate-500">Year total {formatInr(data?.totalAmount)}. Cancelled receipts are excluded.</p>
        </section>
      )}

      {tab === 'class' && (
        <div className="card">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">Active collections for {data?.academicYear}</div>
          <DataTable isLoading={!data && !error} rows={data?.rows || []} rowKey={(row) => row.className} emptyTitle="No class collections" columns={[
            { key: 'class', header: 'Class', render: (row) => row.className },
            { key: 'count', header: 'Payments', align: 'right', render: (row) => row.count },
            { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
          ]} />
        </div>
      )}

      {tab === 'mode' && (
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Payment mode distribution</h2>
            <input className="input w-28" value={year} onChange={(event) => setYear(event.target.value)} />
          </div>
          <ModeChart data={data?.rows || []} />
          <ul className="mt-4 divide-y divide-slate-100">
            {(data?.rows || []).map((row) => (
              <li key={row.mode} className="flex justify-between py-2 text-sm">
                <span>{row.label} · {row.count}</span>
                <span className="tabular-nums">{formatInr(row.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(tab === 'pending' || tab === 'defaulters') && (
        <div className="card">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            {data?.totals?.withDues || 0} with dues · {formatInr(data?.totals?.pendingAmount)}
          </div>
          <DataTable isLoading={!data && !error} rows={data?.rows || []} rowKey={(row) => row.admissionNumber} emptyTitle="No rows" columns={[
            { key: 'student', header: 'Student', render: (row) => row.studentName },
            { key: 'admission', header: 'Admission', render: (row) => row.admissionNumber },
            { key: 'class', header: 'Class', render: (row) => row.className },
            { key: 'paid', header: 'Paid', align: 'right', render: (row) => formatInr(row.paidAmount) },
            { key: 'pending', header: 'Pending', align: 'right', render: (row) => formatInr(row.pendingAmount) },
          ]} />
        </div>
      )}

      {tab === 'cancelled' && (
        <div className="card">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            {data?.count || 0} cancelled · {formatInr(data?.totalAmount)} excluded from collections
          </div>
          <DataTable isLoading={!data && !error} rows={data?.rows || []} rowKey={(row) => row.id} emptyTitle="No cancelled receipts" columns={[
            { key: 'number', header: 'Receipt', render: (row) => row.receiptNumber },
            { key: 'student', header: 'Student', render: (row) => row.studentName },
            { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
            { key: 'when', header: 'Cancelled', render: (row) => formatDateTime(row.cancellation?.cancelledAt) },
            { key: 'by', header: 'By', render: (row) => row.cancellation?.cancelledBy?.name },
            { key: 'reason', header: 'Reason', render: (row) => row.cancellation?.reason },
          ]} />
        </div>
      )}
    </div>
  );
}

function paymentColumns(meta) {
  return [
    { key: 'receipt', header: 'Receipt', render: (row) => row.receiptNumber },
    { key: 'student', header: 'Student', render: (row) => row.studentName },
    { key: 'mode', header: 'Mode', render: (row) => modeLabel(row.paymentMode, meta?.paymentModes) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
  ];
}
