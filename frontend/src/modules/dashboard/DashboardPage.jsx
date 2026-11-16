import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Clock, IndianRupee, Users, Wallet } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { reportService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatDate, formatInr, modeLabel } from '../../utils/format';
import { StatCard } from '../../components/StatCard';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { CollectionChart, ModeChart } from '../../components/Charts';
import { AccessDenied } from '../../components/AccessDenied';
import { Alert } from '../../components/Alert';
import { TeacherDashboardPage } from '../teaching/TeacherDashboardPage';
import { LibraryPage } from '../library/LibraryPage';
import { StudentDashboardPage } from '../student/StudentDashboardPage';

export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'LIBRARIAN') return <LibraryPage />;
  if (user?.role === 'STUDENT') return <StudentDashboardPage />;
  return user?.role === 'TEACHER' ? <TeacherDashboardPage /> : <FinanceDashboardPage />;
}

function FinanceDashboardPage() {
  const { can, meta } = useAuth();
  usePageMeta('Overview', 'Overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('payments');

  useEffect(() => {
    if (!can('reports.read')) return;
    let active = true;
    reportService.dashboard()
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [can]);

  if (!can('reports.read')) return <AccessDenied />;

  const modes = meta?.paymentModes || [];

  return (
    <div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Fee collection" value={formatInr(data?.totals.feeCollection)} hint={data ? data.academicYear : 'Current academic year'} icon={Wallet} />
        <StatCard label="Pending fees" value={formatInr(data?.totals.pendingFees)} hint="Outstanding after active receipts" icon={Clock} />
        <StatCard label="Today's collection" value={formatInr(data?.totals.todayCollection)} hint="Completed payments today" icon={IndianRupee} />
        <StatCard label="Payroll expense" value={formatInr(data?.totals.payrollExpense)} hint="All processed payroll" icon={Banknote} />
        <StatCard label="Students with dues" value={data ? data.totals.studentsWithDues : '—'} hint={data?.academicYear} icon={Users} />
        <StatCard label="Payroll this month" value={formatInr(data?.payrollMonth.netAmount)} hint={data ? `${data.payrollMonth.employeeCount} employees · ${data.payrollMonth.label}` : 'Current month'} icon={Banknote} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Monthly collection</h2>
            <Link to="/reports" className="text-xs font-medium text-blue-700 hover:text-blue-800">View reports</Link>
          </div>
          <CollectionChart data={data?.monthlyCollection || []} />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Payment modes</h2>
          <p className="mb-2 text-xs text-slate-500">{data?.academicYear} active receipts</p>
          <ModeChart data={data?.paymentModes || []} />
          <ul className="mt-2 space-y-1.5 text-sm">
            {(data?.paymentModes || []).map((mode) => (
              <li key={mode.mode} className="flex justify-between text-slate-600">
                <span>{mode.label}</span>
                <span className="tabular-nums text-slate-900">{formatInr(mode.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex gap-4 border-b border-slate-100 px-4">
            {['payments', 'receipts'].map((item) => (
              <button key={item} type="button" className={`border-b-2 py-3 text-sm font-medium capitalize ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`} onClick={() => setTab(item)}>
                Recent {item}
              </button>
            ))}
          </div>
          {tab === 'payments' ? (
            <DataTable
              isLoading={!data && !error}
              rows={data?.recentPayments || []}
              rowKey={(row) => row.id}
              emptyTitle="No payments yet"
              emptyDescription="Collections appear here after an accountant records a fee."
              columns={[
                { key: 'student', header: 'Student', render: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">{row.studentName}</p>
                    <p className="text-xs text-slate-500">{row.admissionNumber}</p>
                  </div>
                ) },
                { key: 'date', header: 'Date', render: (row) => formatDate(row.paymentDate) },
                { key: 'mode', header: 'Mode', render: (row) => modeLabel(row.paymentMode, modes) },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
              ]}
            />
          ) : (
            <DataTable
              rows={data?.recentReceipts || []}
              rowKey={(row) => row.id}
              emptyTitle="No receipts yet"
              columns={[
                { key: 'number', header: 'Receipt', render: (row) => <Link className="font-medium text-blue-700" to={`/fees/receipts/${row.id}`}>{row.receiptNumber}</Link> },
                { key: 'student', header: 'Student', render: (row) => row.studentName },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'balance', header: 'Balance', align: 'right', render: (row) => formatInr(row.remainingBalance) },
                { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatInr(row.amount) },
              ]}
            />
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Pending by class</h2>
          <p className="mt-1 text-xs text-slate-500">Students who still owe fees</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {(data?.pendingByClass || []).length === 0 && <li className="py-6 text-sm text-slate-500">No outstanding class balances.</li>}
            {(data?.pendingByClass || []).map((row) => (
              <li key={row.className} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{row.className}</p>
                  <p className="text-xs text-slate-500">{row.students} {row.students === 1 ? 'student' : 'students'}</p>
                </div>
                <p className="tabular-nums text-slate-900">{formatInr(row.pendingAmount)}</p>
              </li>
            ))}
          </ul>
          <Link to="/fees/defaulters" className="mt-2 inline-block text-xs font-medium text-blue-700">Open defaulter list</Link>
        </section>
      </div>
    </div>
  );
}
