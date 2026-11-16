import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogoMark } from '../components/LogoMark';
import { Alert } from '../components/Alert';
import { getErrorMessage } from '../services/api';
export function LoginPage() {
  const { user, meta, ready, login, bootError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready) return <div className="p-10 text-center">Loading EduFinance…</div>;
  if (user) return <Navigate to="/" replace />;
  if (meta?.setupRequired) return <Navigate to="/setup" replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
    <section className="card w-full max-w-md p-8">
      <div className="mb-6 flex items-center gap-3"><LogoMark /><span className="font-semibold">{meta?.institutionName || 'EduFinance'}</span></div>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-500">Access your finance and payroll account.</p>
      {(error || bootError) && <div className="mt-4"><Alert>{error || bootError}</Alert></div>}
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm">Email<input className="input mt-1" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="block text-sm">Password<input className="input mt-1" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button className="btn-primary w-full" disabled={busy || Boolean(bootError)}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <Link className="mt-5 block text-sm text-blue-700" to="/forgot-password">Forgot password?</Link>
      {meta?.demo && <div className="mt-6 border-t border-slate-200 pt-4"><p className="mb-2 text-sm font-medium">Demonstration accounts</p><p className="mb-3 text-xs text-slate-500">Select a role to fill its sign-in details.</p><div className="space-y-1">{meta.demoAccounts.map(account => <button key={account.email} type="button" className="flex w-full justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setEmail(account.email); setPassword(meta.demoPassword); }}><span>{meta.roleLabels[account.role]}</span><span className="text-xs text-slate-500">{account.email}</span></button>)}</div></div>}
    </section>
  </div>;
}
