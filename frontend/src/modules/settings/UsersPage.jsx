import { useEffect, useState } from 'react';
import api, { unwrap, getErrorMessage } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { Modal } from '../../components/Modal';
export function UsersPage() {
  const { can, meta, user } = useAuth(); const allowed = can('users.manage'); usePageMeta('User accounts', 'Administration');
  const [rows,setRows] = useState([]); const [error,setError] = useState(''); const [open,setOpen] = useState(false); const [editing,setEditing] = useState(null); const [values,setValues] = useState({}); const [busy,setBusy] = useState(false);
  const [students,setStudents] = useState([]);
  async function load() { try { await Promise.all([api.get('/users').then(result=>setRows(unwrap(result))),api.get('/directory/students').then(result=>setStudents(unwrap(result)))]); } catch (err) { setError(getErrorMessage(err)); } }
  useEffect(() => { if (allowed) load(); }, [allowed]);
  function edit(row) { setEditing(row); setValues(row ? { ...row, password: '' } : { name: '', email: '', role: 'ACCOUNTANT', password: '', active: true }); setError(''); setOpen(true); }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = { ...values }; if (editing && !body.password) delete body.password;
      if (editing) await api.patch(`/users/${editing.id}`, body); else await api.post('/users', body);
      setOpen(false); await load();
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  if (!allowed) return <AccessDenied />;
  return <div className="space-y-4"><div className="flex justify-between gap-4"><p className="text-sm text-slate-500">Create accounts and assign permissions. Saving changes revokes that user’s existing sessions.</p><button className="btn-primary shrink-0" onClick={() => edit(null)}>Add user</button></div>
    {error && !open && <Alert>{error}</Alert>}
    <div className="card overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Name','Email','Role','Status','Actions'].map(x => <th className="px-4 py-3 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="border-t border-slate-100" key={row.id}><td className="px-4 py-3">{row.name}</td><td className="px-4 py-3">{row.email}</td><td className="px-4 py-3">{meta?.roleLabels[row.role]}</td><td className="px-4 py-3">{row.active ? 'Active' : 'Disabled'}</td><td className="px-4 py-3"><button className="text-blue-700" onClick={() => edit(row)}>Edit</button></td></tr>)}</tbody></table></div>
    <Modal open={open} title={editing ? 'Edit user' : 'Add user'} onClose={() => { if (!busy) setOpen(false); }}>
      {error && <Alert>{error}</Alert>}<form className="mt-4 space-y-4" onSubmit={save}>
        {[['name','Full name','text'],['email','Email','email'],['password',editing ? 'New password (leave blank to keep)' : 'Password (at least 12 characters)','password']].map(([key,label,type]) => <label className="block text-sm" key={key}>{label}<input className="input mt-1" type={type} required={!editing || key !== 'password'} minLength={key === 'password' ? 12 : undefined} maxLength={key === 'password' ? undefined : 100} autoComplete={key === 'password' ? 'new-password' : 'off'} value={values[key] || ''} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}
        <label className="block text-sm">Role<select className="input mt-1" disabled={editing?.id === user.userId} value={values.role || 'ACCOUNTANT'} onChange={e => setValues({ ...values, role: e.target.value, studentAdmissionNumber: e.target.value === 'STUDENT' ? values.studentAdmissionNumber || '' : '' })}>{Object.entries(meta?.roleLabels || {}).map(([role,label]) => <option key={role} value={role}>{label}</option>)}</select></label>
        {values.role === 'STUDENT' && <label className="block text-sm">Linked student<select className="input mt-1" required value={values.studentAdmissionNumber || ''} onChange={e=>{const student=students.find(s=>s.admissionNumber===e.target.value);setValues({...values,studentAdmissionNumber:e.target.value,name:values.name||student?.name||''});}}><option value="">Choose a student record</option>{students.map(student=><option key={student.id} value={student.admissionNumber}>{student.admissionNumber} · {student.name} · {student.className} {student.section}</option>)}</select><span className="mt-1 block text-xs text-slate-500">This account can see fees and receipts for this student only. Create the student record in Administration first.</span></label>}
        {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={editing.id === user.userId} checked={values.active} onChange={e => setValues({ ...values, active: e.target.checked })} /> Account active</label>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button>
      </form>
    </Modal>
  </div>;
}
