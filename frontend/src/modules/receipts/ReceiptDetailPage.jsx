import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { feeService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { classLabel, formatDateTime, formatInr, modeLabel } from '../../utils/format';
import { LogoMark } from '../../components/LogoMark';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { StatusBadge } from '../../components/StatusBadge';

export function ReceiptDetailPage() {
  const { id } = useParams();
  const { can, meta } = useAuth();
  usePageMeta('Receipt', 'Fee management');
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!can('fees.read')) return;
    feeService.getReceipt(id).then(setReceipt).catch((err) => setError(getErrorMessage(err)));
  }, [id, can]);

  if (!can('fees.read')) return <AccessDenied />;

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/fees/receipts" className="text-sm text-indigo-700">Back to receipts</Link>
        <button type="button" className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
      </div>
      {error && <Alert>{error}</Alert>}
      {receipt && (
        <article className="print-sheet relative mx-auto max-w-2xl card p-8">
          {receipt.status === 'cancelled' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 border-2 border-rose-300 px-4 py-1 text-3xl font-semibold tracking-[0.2em] text-rose-300">CANCELLED</span>
            </div>
          )}
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{receipt.institutionName}</p>
                <p className="text-xs text-slate-500">Finance office</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Fee receipt</p>
              <p className="text-sm font-semibold text-slate-900">{receipt.receiptNumber}</p>
              <div className="mt-1"><StatusBadge status={receipt.status} /></div>
            </div>
          </header>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Student</dt><dd className="font-medium text-slate-900">{receipt.studentName}</dd></div>
            <div><dt className="text-slate-500">Admission number</dt><dd>{receipt.admissionNumber}</dd></div>
            <div><dt className="text-slate-500">Class</dt><dd>{classLabel(receipt.className, receipt.section)}</dd></div>
            <div><dt className="text-slate-500">Academic year</dt><dd>{receipt.academicYear}</dd></div>
            <div><dt className="text-slate-500">Payment date</dt><dd>{formatDateTime(receipt.paymentDate)}</dd></div>
            <div><dt className="text-slate-500">Payment mode</dt><dd>{modeLabel(receipt.paymentMode, meta?.paymentModes)}</dd></div>
            {receipt.chequeNumber && <div><dt className="text-slate-500">Cheque number</dt><dd>{receipt.chequeNumber}</dd></div>}
            {receipt.referenceNumber && <div><dt className="text-slate-500">Reference</dt><dd>{receipt.referenceNumber}</dd></div>}
            <div><dt className="text-slate-500">Received by</dt><dd>{receipt.receivedBy?.name}</dd></div>
          </dl>
          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Fee payment</span>
              <span className="text-lg font-semibold tabular-nums">{formatInr(receipt.amount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Remaining balance after this payment</span>
              <span className="tabular-nums">{formatInr(receipt.remainingBalance)}</span>
            </div>
          </div>
          {receipt.cancellation && (
            <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-medium">Cancellation</p>
              <p className="mt-1">{receipt.cancellation.reason}</p>
              <p className="mt-1 text-xs">By {receipt.cancellation.cancelledBy?.name} on {formatDateTime(receipt.cancellation.cancelledAt)}. Reversed {formatInr(receipt.cancellation.reversedAmount)}.</p>
            </div>
          )}
          <p className="mt-8 text-xs text-slate-400">This is a computer-generated receipt. Cancelled receipts are retained for audit and are excluded from collection totals.</p>
        </article>
      )}
    </div>
  );
}
