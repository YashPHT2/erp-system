import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { payrollService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatInr } from '../../utils/format';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';

export function ProcessPayrollPage() {
  const { can } = useAuth();
  usePageMeta('Process payroll', 'Payroll');
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!can('payroll.read')) return;
    payrollService.salaries().then((data) => {
      setEmployees(data.items.filter((item) => item.profile));
    }).catch((err) => setError(getErrorMessage(err)));
  }, [can]);

  async function loadPreview(event) {
    event?.preventDefault();
    setError('');
    setSuccess(null);
    setPreview(null);
    try {
      setPreview(await payrollService.preview({ employeeId, month: Number(month), year: Number(year) }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const result = await payrollService.process({ employeeId, month: Number(month), year: Number(year) });
      setSuccess(result);
      setConfirmOpen(false);
      setPreview(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!can('payroll.read')) return <AccessDenied />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form className="card space-y-4 p-5" onSubmit={loadPreview}>
        <p className="text-sm text-slate-500">Choose an employee who already has a salary profile. A month can be processed only once.</p>
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">Payroll saved for {success.employeeName}. <Link className="font-medium underline" to={`/payroll/slips/${success.id}`}>Open salary slip</Link></Alert>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Employee</span>
          <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
            <option value="">Select employee</option>
            {employees.map((item) => (
              <option key={item.employee.id} value={item.employee.id}>{item.employee.name} · {item.employee.employeeCode}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Month</span>
            <select className="input" value={month} onChange={(event) => setMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Year</span>
            <input className="input" value={year} onChange={(event) => setYear(event.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn-secondary" disabled={!can('payroll.write')}>Preview breakdown</button>
        {!can('payroll.write') && <p className="text-xs text-slate-500">Only a Super Admin or Accountant can process payroll.</p>}
      </form>

      <section className="card p-5">
        {!preview && <p className="text-sm text-slate-500">The salary breakdown appears here before you confirm.</p>}
        {preview && (
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{preview.employee.name}</h2>
            <p className="text-xs text-slate-500">{preview.employee.designation} · {preview.periodLabel}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Basic salary" value={preview.basicSalary} />
              {preview.allowances.map((item) => <Row key={`${item.code}-${item.label}`} label={item.label} value={item.amount} />)}
              {preview.deductions.map((item) => <Row key={`${item.code}-${item.label}`} label={item.label} value={-item.amount} deduct />)}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                <dt>Net salary</dt>
                <dd className="tabular-nums">{formatInr(preview.netSalary)}</dd>
              </div>
            </dl>
            {can('payroll.write') && (
              <button type="button" className="btn-primary mt-5" onClick={() => setConfirmOpen(true)}>Confirm payroll</button>
            )}
          </div>
        )}
      </section>

      <ConfirmationDialog open={confirmOpen} title="Process payroll" confirmLabel="Process payroll" isBusy={busy} onClose={() => setConfirmOpen(false)} onConfirm={confirm}>
        <p>Save {formatInr(preview?.netSalary)} for {preview?.employee.name} for {preview?.periodLabel}. This cannot be entered again for the same month.</p>
      </ConfirmationDialog>
    </div>
  );
}

function Row({ label, value, deduct }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`tabular-nums ${deduct ? 'text-rose-700' : 'text-slate-900'}`}>{deduct ? '−' : ''}{formatInr(Math.abs(value))}</dd>
    </div>
  );
}
