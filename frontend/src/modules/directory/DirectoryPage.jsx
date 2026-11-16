import { useEffect, useState } from 'react';
import api, { unwrap, getErrorMessage } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { Modal } from '../../components/Modal';
const fields = {
  students: [['admissionNumber','Admission number'],['name','Full name'],['className','Class'],['section','Section'],['academicYear','Academic year']],
  employees: [['employeeCode','Employee code'],['name','Full name'],['designation','Designation'],['department','Department'],['status','Status']],
};
export function DirectoryPage({ kind }) {
  const { can, meta } = useAuth(); const title = kind === 'students' ? 'Students' : 'Employees';
  usePageMeta(title, 'Directory');
  const allowed = can(`directory.${kind}`); const provider = meta?.[kind === 'students' ? 'studentProvider' : 'employeeProvider'];
  const [rows, setRows] = useState([]); const [search, setSearch] = useState(''); const [error, setError] = useState('');
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState(null); const [values, setValues] = useState({}); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  async function load() {
    setError(''); setLoading(true);
    try { setRows(unwrap(await api.get(`/directory/${kind}`, { params: { search } }))); }
    catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { if (allowed) load(); }, [kind, search, allowed]);
  function edit(row) {
    setEditing(row); setValues(row ? { ...row } : { academicYear: meta?.academicYear || '', section: '', status: 'active' }); setError(''); setOpen(true);
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (editing) await api.put(`/directory/${kind}/${editing.id}`, values);
      else await api.post(`/directory/${kind}`, values);
      setOpen(false); await load();
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  if (!allowed) return <AccessDenied />;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Manage your institution’s {kind}.</p>{provider === 'mongo' && <button className="btn-primary" onClick={() => edit(null)}>Add {kind === 'students' ? 'student' : 'employee'}</button>}</div>
    {provider === 'http' && <Alert tone="info">These records are managed by your connected directory.</Alert>}
    {error && !open && <Alert>{error}</Alert>}
    <input aria-label={`Search ${kind}`} className="input max-w-sm" placeholder={`Search ${kind}`} value={search} onChange={e => setSearch(e.target.value)} />
    <div className="card overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{fields[kind].map(([key,label]) => <th className="px-4 py-3 text-left" key={key}>{label}</th>)}<th className="px-4 py-3 text-left">Actions</th></tr></thead><tbody>
      {rows.map(row => <tr className="border-t border-slate-100" key={row.id}>{fields[kind].map(([key]) => <td className="px-4 py-3" key={key}>{row[key] || '—'}</td>)}<td className="px-4 py-3">{provider === 'mongo' && <button className="text-blue-700" onClick={() => edit(row)}>Edit</button>}</td></tr>)}
      {!rows.length && <tr><td className="p-8 text-center text-slate-500" colSpan={fields[kind].length+1}>{loading ? 'Loading…' : `No ${kind} found. Add your first record to get started.`}</td></tr>}
    </tbody></table></div>
    <Modal open={open} title={`${editing ? 'Edit' : 'Add'} ${kind === 'students' ? 'student' : 'employee'}`} onClose={() => { if (!busy) setOpen(false); }}>
      {error && <Alert>{error}</Alert>}<form className="mt-4 space-y-4" onSubmit={save}>
        {fields[kind].map(([key,label]) => <label className="block text-sm" key={key}>{label}{key === 'status' ? <select className="input mt-1" value={values[key] || 'active'} onChange={e => setValues({ ...values, [key]: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select> : <input className="input mt-1" required={key !== 'section'} maxLength={100} value={values[key] || ''} onChange={e => setValues({ ...values, [key]: e.target.value })} disabled={Boolean(editing) && key === 'employeeCode'} />}</label>)}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </Modal>
  </div>;
}
