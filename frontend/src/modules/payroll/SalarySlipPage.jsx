import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { payrollService } from '../../services/financeService';
import { teachingService } from '../teaching/teachingService';
import { getErrorMessage } from '../../services/api';
import { formatDate, formatInr } from '../../utils/format';
import { LogoMark } from '../../components/LogoMark';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { StatusBadge } from '../../components/StatusBadge';

export function SalarySlipPage({ teacher = false }) {
  const { id } = useParams();
  const { can } = useAuth();
  const allowed = can(teacher ? 'teaching.self' : 'payroll.read');
  usePageMeta('Salary slip', 'Payroll');
  const [slip, setSlip] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowed) return;
    setSlip(null); setError('');
    (teacher ? teachingService : payrollService).slip(id).then(setSlip).catch((err) => setError(getErrorMessage(err)));
  }, [id, allowed, teacher]);

  if (!allowed) return <AccessDenied />;

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to={teacher ? '/teacher/salary' : '/payroll/slips'} className="text-sm text-blue-700">Back to salary slips</Link>
        <button type="button" className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
      </div>
      {error && <Alert>{error}</Alert>}
      {slip && (
        <article className="print-sheet mx-auto max-w-2xl card p-8">
          <header className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-sm font-semibold">{slip.institutionName}</p>
                <p className="text-xs text-slate-500">Salary slip</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{slip.periodLabel}</p>
              <div className="mt-1"><StatusBadge status={slip.status} /></div>
            </div>
          </header>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Employee</dt><dd className="font-medium">{slip.employeeName}</dd></div>
            <div><dt className="text-slate-500">Employee ID</dt><dd>{slip.employeeCode}</dd></div>
            <div><dt className="text-slate-500">Designation</dt><dd>{slip.designation}</dd></div>
            <div><dt className="text-slate-500">Department</dt><dd>{slip.department}</dd></div>
            <div><dt className="text-slate-500">Processed</dt><dd>{formatDate(slip.processedAt)}</dd></div>
            <div><dt className="text-slate-500">Payment date</dt><dd>{formatDate(slip.paidAt)}</dd></div>
          </dl>
          <table className="mt-6 w-full text-sm">
            <tbody>
              <tr className="border-t border-slate-100"><td className="py-2">Basic salary</td><td className="py-2 text-right tabular-nums">{formatInr(slip.basicSalary)}</td></tr>
              {slip.allowances.map((item) => (
                <tr key={`${item.code}-${item.label}`} className="border-t border-slate-100"><td className="py-2">{item.label}</td><td className="py-2 text-right tabular-nums">{formatInr(item.amount)}</td></tr>
              ))}
              {slip.deductions.map((item) => (
                <tr key={`${item.code}-${item.label}`} className="border-t border-slate-100"><td className="py-2">{item.label}</td><td className="py-2 text-right tabular-nums text-rose-700">−{formatInr(item.amount)}</td></tr>
              ))}
              <tr className="border-t border-slate-200 font-semibold"><td className="py-3">Net salary</td><td className="py-3 text-right tabular-nums">{formatInr(slip.netSalary)}</td></tr>
            </tbody>
          </table>
          <p className="mt-6 text-xs text-slate-400">Net salary = basic salary + allowances − deductions. This slip uses the salary snapshot from the day payroll was processed.</p>
        </article>
      )}
    </div>
  );
}
