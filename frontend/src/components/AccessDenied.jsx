import { ShieldOff } from 'lucide-react';

export function AccessDenied() {
  return (
    <div className="card px-6 py-16 text-center">
      <ShieldOff className="mx-auto h-8 w-8 text-slate-400" strokeWidth={1.5} />
      <h2 className="mt-3 text-base font-semibold text-slate-900">You do not have access to this section</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Your role does not include this finance permission. A Super Admin can review access if your work requires it.
      </p>
    </div>
  );
}
