import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { settingsService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';

export function SettingsPage() {
  const { can } = useAuth();
  usePageMeta('Settings', 'Settings');
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!can('settings.read')) return;
    settingsService.get().then(setSettings).catch((err) => setError(getErrorMessage(err)));
  }, [can]);

  if (!can('settings.read')) return <AccessDenied />;

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Institution</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Name" value={settings?.institutionName} />
          <Item label="Academic year" value={settings?.academicYear} />
          <Item label="Timezone" value={settings?.timezone} />
          <Item label="Currency" value={settings?.currency} />
          <Item label="Authentication" value={settings?.authMode === 'mock' ? 'Development mock' : 'Shared JWT'} />
          <Item label="Overpayment policy" value={settings?.overpaymentAllowed ? 'Allowed with explicit approval' : 'Not allowed'} />
          <Item label="Student records" value={settings?.integration?.students?.provider} />
          <Item label="Employee records" value={settings?.integration?.employees?.provider} />
        </dl>
      </section>
      <section className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Role permissions</h2>
          <p className="mt-1 text-xs text-slate-500">Enforced on the server. The screens only hide actions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Permission</th>
                {(settings?.roles || []).map((role) => <th key={role.role} className="px-3 py-2.5 font-medium">{role.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(settings?.permissions || []).map((permission) => (
                <tr key={permission.key}>
                  <td className="px-4 py-3 text-slate-800">{permission.label}</td>
                  {(settings?.roles || []).map((role) => (
                    <td key={role.role} className="px-3 py-3 text-center text-slate-500">
                      {permission.roles.includes(role.role) ? 'Yes' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value || '—'}</dd>
    </div>
  );
}
