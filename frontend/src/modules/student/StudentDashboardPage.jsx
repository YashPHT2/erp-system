import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, CircleCheck, Clock, Receipt } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getErrorMessage } from '../../services/api';
import { formatDate, formatInr, modeLabel, classLabel } from '../../utils/format';
import { StatCard } from '../../components/StatCard';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { Pagination } from '../../components/Pagination';
import { studentService } from './studentService';

const titles = { overview: 'Student fee dashboard', fees: 'My fee breakdown', payments: 'My payment history', receipts: 'My receipts' };
export function StudentDashboardPage({ tab = 'overview' }) {
  const { can, meta } = useAuth(); const allowed = can('student.self');
  usePageMeta(titles[tab], 'Student workspace');
  const [data,setData] = useState(null); const [year,setYear] = useState(''); const [error,setError] = useState('');
  const [history,setHistory] = useState(null); const [page,setPage] = useState(1);
  useEffect(() => {
    let active = true; setData(null); setError('');
    if (allowed) studentService.overview({ academicYear: year || undefined }).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [allowed, year]);
  useEffect(() => {
    let active = true; setHistory(null);
    if (allowed && data && ['payments','receipts'].includes(tab)) studentService[tab]({ academicYear: data.academicYear, page }).then(result => { if (active) setHistory(result); }).catch(err => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [allowed, data?.academicYear, tab, page]);
  if (!allowed) return <AccessDenied />;
  if (!data) return error ? <Alert>{error}</Alert> : <p className="p-6 text-sm text-slate-500">Loading your fee account…</p>;
  const account = data.account;
  const percent = account?.totalFee > 0 ? Math.min(100, Math.max(0, account.paidAmount / account.totalFee * 100)) : 0;
  const settled = account && account.pendingAmount === 0;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-900">{tab === 'overview' ? `Welcome, ${data.student.name}` : titles[tab]}</h2><p className="mt-1 text-sm text-slate-500">Your school fee account, payments, and receipts.</p></div><label className="min-w-44 text-sm">Academic year<select className="input mt-1" value={year || data.academicYear} onChange={e => { setYear(e.target.value); setPage(1); }}>{data.academicYears.map(item => <option key={item}>{item}</option>)}</select></label></div>
    <nav aria-label="Student workspace" className="flex gap-2 overflow-x-auto pb-1">{Object.entries(titles).map(([key,title]) => <Link key={key} to={key === 'overview' ? '/' : `/student/${key}`} className={`shrink-0 rounded-md px-3 py-2 text-sm ${tab === key ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{key === 'overview' ? 'Overview' : title.replace('My ', '')}</Link>)}</nav>
    {error && <Alert>{error}</Alert>}
    <section className="card flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Student account</p><h3 className="mt-1 font-semibold">{data.student.name}</h3><p className="mt-1 text-sm text-slate-500">{data.student.admissionNumber} · {classLabel(data.student.className,data.student.section)} · Enrollment {data.student.academicYear}</p></div><span className={`rounded-full px-3 py-1 text-sm font-medium ${!account ? 'bg-slate-100 text-slate-600' : settled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{!account ? 'Fees not assigned' : settled ? 'Fees paid' : 'Payment pending'}</span></section>
    {!account && <Alert tone="info">Your fee structure has not been assigned yet. Contact the accounts office for your fee details.</Alert>}
    {['overview','fees'].includes(tab) && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total fees" value={account ? formatInr(account.totalFee) : '—'} hint={data.academicYear} icon={Wallet}/>
        <StatCard label="Amount paid" value={account ? formatInr(account.paidAmount) : '—'} hint="After cancelled payment reversals" icon={CircleCheck}/>
        <StatCard label="Pending balance" value={account ? formatInr(account.pendingAmount) : '—'} hint={account?.advanceAmount ? `${formatInr(account.advanceAmount)} advance credit` : 'Remaining fee amount'} icon={Clock}/>
        <StatCard label="Active receipts" value={data.activeReceiptCount} hint="Cancelled receipts excluded" icon={Receipt}/>
      </div>
      {account && <section className="card p-5"><div className="mb-3 flex justify-between text-sm"><h3 className="font-semibold">Fee payment progress</h3><span className="font-medium text-blue-700">{percent.toFixed(0)}% paid</span></div><div role="progressbar" aria-label="Fee payment progress" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${percent}%`}}/></div><p className="mt-3 text-sm text-slate-500">{settled ? 'Your fee balance for this academic year is clear.' : 'Contact the accounts office to make or reconcile a payment.'}</p></section>}
      <section className="card overflow-x-auto"><div className="p-5"><h3 className="font-semibold">Fee components</h3><p className="mt-1 text-xs text-slate-500">Charges for {data.academicYear}</p></div><DataTable rows={account?.components || []} rowKey={row=>row.code+row.label} emptyTitle="No fee components available" columns={[{key:'component',header:'Component',render:row=>row.label},{key:'amount',header:'Amount',align:'right',render:row=>formatInr(row.amount)}]}/>{account && <div className="flex justify-between border-t border-slate-200 px-5 py-4 text-sm font-semibold"><span>Total fee</span><span>{formatInr(account.totalFee)}</span></div>}</section>
    </>}
    {tab === 'overview' && <div className="grid gap-5 xl:grid-cols-2"><section className="card overflow-hidden"><div className="flex items-center justify-between p-5"><h3 className="font-semibold">Recent payments</h3><Link to="/student/payments" className="text-sm text-blue-700">View all</Link></div><PaymentTable rows={data.recentPayments} modes={meta?.paymentModes}/></section><section className="card overflow-hidden"><div className="flex items-center justify-between p-5"><h3 className="font-semibold">Recent receipts</h3><Link to="/student/receipts" className="text-sm text-blue-700">View all</Link></div><ReceiptTable rows={data.recentReceipts}/></section></div>}
    {['payments','receipts'].includes(tab) && <section className="card overflow-hidden"><div className="p-5"><h3 className="font-semibold">{tab === 'payments' ? 'Payment history' : 'Your receipts'}</h3><p className="mt-1 text-sm text-slate-500">{tab === 'payments' ? 'Payments recorded against your student account. Cancelled payments do not count toward your paid amount.' : 'Open a receipt to view or print it. Cancelled receipts remain available for reference.'}</p></div>{tab === 'payments' ? <PaymentTable rows={history?.items || []} loading={!history&&!error} modes={meta?.paymentModes}/> : <ReceiptTable rows={history?.items || []} loading={!history&&!error}/>}<Pagination page={history?.page || page} pages={history?.pages || 1} onPage={setPage}/></section>}
  </div>;
}
function PaymentTable({ rows, loading, modes }) {
  return <DataTable rows={rows} isLoading={loading} rowKey={row=>row.id} emptyTitle="No payments recorded yet" columns={[
    {key:'date',header:'Date',render:row=>formatDate(row.paymentDate)},
    {key:'mode',header:'Method',render:row=>modeLabel(row.paymentMode,modes)},
    {key:'status',header:'Status',render:row=><StatusBadge status={row.status}/>},
    {key:'amount',header:'Amount',align:'right',render:row=>formatInr(row.amount)},
    {key:'receipt',header:'Receipt',render:row=>row.receiptId ? <Link className="text-blue-700" to={`/student/receipts/${row.receiptId}`}>View</Link> : '—'},
  ]}/>;
}
function ReceiptTable({ rows, loading }) {
  return <DataTable rows={rows} isLoading={loading} rowKey={row=>row.id} emptyTitle="No receipts available yet" columns={[
    {key:'number',header:'Receipt',render:row=><Link className="font-medium text-blue-700" to={`/student/receipts/${row.id}`}>{row.receiptNumber}</Link>},
    {key:'date',header:'Date',render:row=>formatDate(row.paymentDate)},
    {key:'status',header:'Status',render:row=><StatusBadge status={row.status}/>},
    {key:'amount',header:'Amount',align:'right',render:row=>formatInr(row.amount)},
  ]}/>;
}
