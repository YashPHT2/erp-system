import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

export function NotFoundPage() {
  usePageMeta('Not found', 'EduFinance');
  return (
    <div className="card px-6 py-16 text-center">
      <h2 className="text-base font-semibold">This page is not part of finance</h2>
      <p className="mt-1 text-sm text-slate-500">The address does not match a fee or payroll screen.</p>
      <Link to="/" className="btn-primary mt-4">Back to overview</Link>
    </div>
  );
}
