import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { feeService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { classLabel, formatDate, formatInr, modeLabel } from '../../utils/format';
import { SearchBar } from '../../components/SearchBar';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { StatusBadge } from '../../components/StatusBadge';

export function CollectFeePage() {
  const { can, meta, user } = useAuth();
  usePageMeta('Collect fee', 'Fee management');
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const debounced = useDebouncedValue(query);
  const [results, setResults] = useState([]);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);
  const idempotencyKey = useRef('');
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { amount: '', paymentMode: 'cash', chequeNumber: '', referenceNumber: '', remarks: '' },
  });
  const paymentMode = watch('paymentMode');
  const amount = watch('amount');

  useEffect(() => {
    if (!can('fees.read') || debounced.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    feeService.searchStudents(debounced.trim())
      .then((items) => { if (active) setResults(items); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [debounced, can]);

  async function selectStudent(admissionNumber) {
    setError('');
    setSuccess(null);
    idempotencyKey.current = '';
    try {
      const view = await feeService.feeAccount({ admissionNumber, academicYear: meta?.academicYear });
      setAccount(view);
      reset({ amount: '', paymentMode: 'cash', chequeNumber: '', referenceNumber: '', remarks: '' });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    const initial = params.get('q');
    if (initial && can('fees.read')) selectStudent(initial);
  }, [meta?.academicYear]);

  function beginConfirm() {
    idempotencyKey.current = idempotencyKey.current || crypto.randomUUID();
    setConfirmOpen(true);
  }

  async function confirmPayment(values) {
    setBusy(true);
    setError('');
    try {
      const result = await feeService.collect({
        idempotencyKey: idempotencyKey.current,
        admissionNumber: account.student.admissionNumber,
        academicYear: account.student.academicYear,
        amount: values.amount,
        paymentMode: values.paymentMode,
        chequeNumber: values.chequeNumber,
        referenceNumber: values.referenceNumber,
        remarks: values.remarks,
      });
      setSuccess(result);
      setConfirmOpen(false);
      idempotencyKey.current = '';
      const view = await feeService.feeAccount({
        admissionNumber: account.student.admissionNumber,
        academicYear: account.student.academicYear,
      });
      setAccount(view);
      reset({ amount: '', paymentMode: 'cash', chequeNumber: '', referenceNumber: '', remarks: '' });
    } catch (err) {
      setError(getErrorMessage(err));
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!can('fees.read')) return <AccessDenied />;

  const pending = account?.account?.pendingAmount ?? 0;
  const entered = Number(amount) || 0;
  const modes = meta?.paymentModes || [];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="card p-4">
        <SearchBar value={query} onChange={(value) => { setQuery(value); idempotencyKey.current = ''; }} placeholder="Name or admission number" />
        <div className="mt-3 divide-y divide-slate-100">
          {debounced.trim().length < 2 && <p className="py-6 text-sm text-slate-500">Type at least 2 characters to search the student directory.</p>}
          {debounced.trim().length >= 2 && results.length === 0 && <p className="py-6 text-sm text-slate-500">No matching students.</p>}
          {results.map((student) => (
            <button key={student.id} type="button" className="block w-full py-3 text-left hover:bg-slate-50" onClick={() => selectStudent(student.admissionNumber)}>
              <p className="text-sm font-medium text-slate-900">{student.name}</p>
              <p className="text-xs text-slate-500">{student.admissionNumber} · {classLabel(student.className, student.section)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {success && (
          <Alert tone="success">
            Receipt {success.receipt?.receiptNumber} recorded.{' '}
            <Link className="font-medium underline" to={`/fees/receipts/${success.receipt?.id}`}>View receipt</Link>
          </Alert>
        )}
        {!account && <div className="card px-6 py-16 text-center text-sm text-slate-500">Search for a student to see the fee account.</div>}
        {account && (
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{account.student.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {account.student.admissionNumber} · {classLabel(account.student.className, account.student.section)} · {account.student.academicYear}
                </p>
              </div>
              <p className="text-xs text-slate-500">Received by {user?.name}</p>
            </div>
            {!account.feeStructure && <div className="mt-4"><Alert tone="warning">No fee structure is configured for this class.</Alert></div>}
            {account.classMismatch && <div className="mt-4"><Alert tone="warning">The fee account class does not match the student record. Collection is blocked until a principal reviews it.</Alert></div>}
            {account.account && (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['Total fee', account.account.totalFee],
                  ['Paid', account.account.paidAmount],
                  ['Pending', account.account.pendingAmount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-200 px-3 py-2.5">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatInr(value)}</p>
                  </div>
                ))}
              </div>
            )}

            {can('fees.collect') && account.account && pending > 0 && !account.classMismatch && (
              <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(beginConfirm)}>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span>
                  <input className={`input ${errors.amount ? 'input-error' : ''}`} inputMode="decimal" {...register('amount', { required: 'Enter an amount' })} />
                  {errors.amount && <span className="mt-1 block text-xs text-rose-600">{errors.amount.message}</span>}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Payment mode</span>
                  <select className="input" {...register('paymentMode')}>
                    {modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                  </select>
                </label>
                {paymentMode === 'cheque' && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Cheque number</span>
                    <input className="input" {...register('chequeNumber', { required: 'Cheque number is required' })} />
                  </label>
                )}
                {paymentMode === 'bank_transfer' && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Transfer reference</span>
                    <input className="input" {...register('referenceNumber', { required: 'Reference is required' })} />
                  </label>
                )}
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</span>
                  <input className="input" {...register('remarks')} />
                </label>
                <div className="sm:col-span-2 flex justify-end">
                  <button type="submit" className="btn-primary">Review payment</button>
                </div>
              </form>
            )}
            {account.account && pending <= 0 && <p className="mt-5 text-sm text-slate-500">This student has no pending dues.</p>}
            {!can('fees.collect') && <p className="mt-5 text-sm text-slate-500">Your role can view this account, but only an Accountant or Fee Clerk can collect fees.</p>}

            {account.recentPayments?.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-medium text-slate-900">Recent payments</h3>
                <ul className="mt-2 divide-y divide-slate-100">
                  {account.recentPayments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{formatDate(payment.paymentDate)} · {modeLabel(payment.paymentMode, modes)}</span>
                      <span className="flex items-center gap-3">
                        <StatusBadge status={payment.status} />
                        <span className="tabular-nums">{formatInr(payment.amount)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm fee payment"
        confirmLabel="Record payment"
        isBusy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit(confirmPayment)}
      >
        <dl className="space-y-2">
          <div className="flex justify-between"><dt>Student</dt><dd className="font-medium text-slate-900">{account?.student.name}</dd></div>
          <div className="flex justify-between"><dt>Admission number</dt><dd>{account?.student.admissionNumber}</dd></div>
          <div className="flex justify-between"><dt>Amount</dt><dd className="tabular-nums">{formatInr(entered)}</dd></div>
          <div className="flex justify-between"><dt>Mode</dt><dd>{modeLabel(paymentMode, modes)}</dd></div>
          <div className="flex justify-between"><dt>Pending before</dt><dd className="tabular-nums">{formatInr(pending)}</dd></div>
          <div className="flex justify-between"><dt>Pending after</dt><dd className="tabular-nums">{formatInr(Math.max(pending - entered, 0))}</dd></div>
        </dl>
      </ConfirmationDialog>
    </div>
  );
}
