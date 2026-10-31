import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { user, ready, bootError } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-slate-500">
        Loading EduFinance…
      </div>
    );
  }
  if (bootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="card max-w-md p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Finance API is unavailable</p>
          <p className="mt-2">Start the backend and confirm MongoDB is running, then refresh this page.</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
