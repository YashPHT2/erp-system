import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogoMark } from '../components/LogoMark';
import { Alert } from '../components/Alert';
import { getErrorMessage } from '../services/api';

export function LoginPage() {
  const { user, meta, ready, login, acceptToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to="/" replace />;

  async function onLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onToken(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await acceptToken(token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[440px_1fr]">
      <section className="hidden flex-col justify-between bg-slate-950 px-10 py-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="text-sm font-semibold">EduFinance</p>
            <p className="text-xs text-slate-400">School & university ERP</p>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-3xl font-semibold tracking-tight">Fee collection and payroll, with an audit trail.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Record payments, issue receipts, and process salaries without mixing this module into student or academic records.
          </p>
        </div>
        <p className="text-xs text-slate-500">Northbridge Educational Institute</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <p className="text-sm font-semibold">EduFinance</p>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            {meta?.authMode === 'jwt'
              ? 'Use the access token issued by the main ERP authentication module.'
              : 'Development login for the finance module. This is separate from production authentication.'}
          </p>

          {!meta?.devUsersReady && meta?.authMode !== 'jwt' && (
            <div className="mt-4">
              <Alert tone="warning">Run the seed script to create development users before signing in.</Alert>
            </div>
          )}
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}

          {meta?.authMode === 'jwt' ? (
            <form className="mt-6 space-y-4" onSubmit={onToken}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Access token</span>
                <textarea value={token} onChange={(event) => setToken(event.target.value)} className="input h-28 py-2" placeholder="Paste the bearer token" />
              </label>
              <button type="submit" className="btn-primary w-full" disabled={busy || !token.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onLogin}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input" required />
              </label>
              <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
          )}

          {meta?.authMode !== 'jwt' && meta?.demoAccounts?.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Development accounts</p>
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {meta.demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password || '');
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{account.name}</span>
                      <span className="block text-xs text-slate-500">{account.email}</span>
                    </span>
                    <span className="text-xs text-slate-500">{account.roleLabel}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Shown only while mock authentication is enabled.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
