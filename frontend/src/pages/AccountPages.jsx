import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api, { authApi, getErrorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Alert } from '../components/Alert';
function Frame({ title, children }) {
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10"><section className="card w-full max-w-md p-8"><h1 className="mb-5 text-xl font-semibold">{title}</h1>{children}<Link className="mt-5 block text-sm text-blue-700" to="/login">Back to sign in</Link></section></div>;
}
function Field({ label, ...props }) { return <label className="block text-sm">{label}<input className="input mt-1" {...props} /></label>; }
export function SetupPage() {
  const { meta, ready, reloadMeta, bootError } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(() => ({ name: '', email: '', password: '', confirmation: '', setupToken: new URLSearchParams(window.location.hash.slice(1)).get('key') || '' }));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (ready && meta && !meta.setupRequired) return <Navigate to="/login" replace />;
  const field = key => ({ value: values[key], onChange: e => setValues({ ...values, [key]: e.target.value }) });
  async function submit(e) {
    e.preventDefault(); setError('');
    if (values.password !== values.confirmation) return setError('Passwords do not match.');
    setBusy(true);
    try { await authApi.post('/auth/setup', values); window.history.replaceState(null, '', '/setup'); await reloadMeta(); navigate('/login', { replace: true }); }
    catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <Frame title="Create administrator account"><p className="mb-4 text-sm text-slate-500">Set up your first account. Use the setup key from the server configuration.</p>{(error || bootError) && <Alert>{error || bootError}</Alert>}
    <form className="mt-4 space-y-4" onSubmit={submit}>
      <Field label="Setup key" type="password" autoComplete="off" required {...field('setupToken')} />
      <Field label="Full name" autoComplete="name" required maxLength={100} {...field('name')} />
      <Field label="Email" type="email" autoComplete="username" required {...field('email')} />
      <Field label="Password (at least 12 characters)" type="password" autoComplete="new-password" required minLength={12} {...field('password')} />
      <Field label="Confirm password" type="password" autoComplete="new-password" required {...field('confirmation')} />
      <button className="btn-primary w-full" disabled={!ready || busy || Boolean(bootError)}>{busy ? 'Creating account…' : 'Create administrator'}</button>
    </form></Frame>;
}
export function ForgotPasswordPage() {
  const { meta } = useAuth(); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const result = await authApi.post('/auth/forgot-password', { email }); setMessage(result.data.message); }
    catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <Frame title="Reset your password">{meta && !meta.passwordResetAvailable ? <Alert tone="info">Password-reset email is not configured yet. Contact your administrator to change your password.</Alert> : <form className="space-y-4" onSubmit={submit}>
    <Field label="Email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
    <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
  </form>}{error && <Alert>{error}</Alert>}{message && <Alert tone="success">{message}</Alert>}</Frame>;
}
export function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError('');
    if (password !== confirmation) return setError('Passwords do not match.');
    setBusy(true);
    try { const result = await authApi.post('/auth/reset-password', { token, newPassword: password }); setMessage(result.data.message); window.history.replaceState(null, '', '/reset-password'); }
    catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <Frame title="Choose a new password">{!token ? <Alert>This reset link is invalid.</Alert> : message ? <Alert tone="success">{message}</Alert> : <form className="space-y-4" onSubmit={submit}>
    <Field label="New password (at least 12 characters)" type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
    <Field label="Confirm password" type="password" required autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
    <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
  </form>}{error && <div className="mt-4"><Alert>{error}</Alert></div>}</Frame>;
}
export function ChangePasswordPage() {
  const { endSession } = useAuth(); const [currentPassword, setCurrent] = useState(''); const [newPassword, setNext] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError('');
    if (newPassword !== confirmation) return setError('Passwords do not match.');
    setBusy(true);
    try { await api.post('/auth/change-password', { currentPassword, newPassword }); endSession(); }
    catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <section className="card max-w-md p-6"><h2 className="mb-4 text-lg font-semibold">Change password</h2><p className="mb-4 text-sm text-slate-500">Changing your password signs you out of every session.</p>{error && <Alert>{error}</Alert>}<form className="mt-4 space-y-4" onSubmit={submit}>
    <Field label="Current password" type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} />
    <Field label="New password (at least 12 characters)" type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={e => setNext(e.target.value)} />
    <Field label="Confirm new password" type="password" required autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
    <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
  </form></section>;
}
