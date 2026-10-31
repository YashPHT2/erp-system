import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { payrollService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatInr } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { Modal } from '../../components/Modal';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';

export function SalaryProfilesPage() {
  const { can, meta } = useAuth();
  usePageMeta('Employee salaries', 'Payroll');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register, control, handleSubmit, reset, watch } = useForm({
    defaultValues: { basicSalary: '', allowances: [], deductions: [] },
  });
  const allowances = useFieldArray({ control, name: 'allowances' });
  const deductions = useFieldArray({ control, name: 'deductions' });
  const values = watch();
  const allowanceTotal = (values.allowances || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const deductionTotal = (values.deductions || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const net = (Number(values.basicSalary) || 0) + allowanceTotal - deductionTotal;

  async function load() {
    try {
      const data = await payrollService.salaries({ search });
      setRows(data.items);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    if (can('payroll.read')) load();
  }, [can, search]);

  function openEditor(row) {
    setEditing(row);
    setFormError('');
    reset({
      basicSalary: row.profile ? String(row.profile.basicSalary) : '',
      allowances: row.profile?.allowances?.map((item) => ({ ...item, amount: String(item.amount) })) || [],
      deductions: row.profile?.deductions?.map((item) => ({ ...item, amount: String(item.amount) })) || [],
    });
  }

  async function onSave(form) {
    setBusy(true);
    setFormError('');
    try {
      await payrollService.saveSalary(editing.employee.id, {
        basicSalary: form.basicSalary,
        allowances: form.allowances.filter((item) => item.amount),
        deductions: form.deductions.filter((item) => item.amount),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!can('payroll.read')) return <AccessDenied />;

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">Salary components are stored for payroll. Employee names and designations come from the shared employee directory.</p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="mb-4 max-w-md"><SearchBar value={search} onChange={setSearch} placeholder="Search employee" /></div>
      <div className="card">
        <DataTable
          isLoading={!rows}
          rows={rows || []}
          rowKey={(row) => row.employee.id}
          emptyTitle="No employees"
          columns={[
            { key: 'name', header: 'Employee', render: (row) => (
              <div>
                <p className="font-medium text-slate-900">{row.employee.name}</p>
                <p className="text-xs text-slate-500">{row.employee.employeeCode} · {row.employee.designation}</p>
              </div>
            ) },
            { key: 'department', header: 'Department', render: (row) => row.employee.department },
            { key: 'basic', header: 'Basic', align: 'right', render: (row) => formatInr(row.profile?.basicSalary) },
            { key: 'net', header: 'Net', align: 'right', render: (row) => formatInr(row.profile?.netSalary) },
            { key: 'action', header: '', render: (row) => can('payroll.write') ? (
              <button type="button" className="btn-secondary h-8" onClick={() => openEditor(row)}>{row.profile ? 'Edit' : 'Set salary'}</button>
            ) : null },
          ]}
        />
      </div>

      <Modal open={Boolean(editing)} title={editing ? `Salary · ${editing.employee.name}` : 'Salary'} onClose={() => setEditing(null)} wide>
        <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
          {formError && <Alert>{formError}</Alert>}
          <label className="block max-w-xs">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Basic salary</span>
            <input className="input" inputMode="decimal" {...register('basicSalary', { required: true })} />
          </label>
          <ComponentEditor title="Allowances" fields={allowances} register={register} name="allowances" options={meta?.allowances || []} />
          <ComponentEditor title="Deductions" fields={deductions} register={register} name="deductions" options={meta?.deductions || []} />
          <p className="text-sm text-slate-600">Net salary <span className="font-semibold tabular-nums text-slate-900">{formatInr(net)}</span></p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save salary'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ComponentEditor({ title, fields, register, name, options }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-800">{title}</h3>
        <button type="button" className="btn-secondary h-8" onClick={() => fields.append({ code: options[0]?.code || 'OTHER', label: '', amount: '' })}>Add</button>
      </div>
      <div className="space-y-2">
        {fields.fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
            <select className="input" {...register(`${name}.${index}.code`)}>
              {options.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
            <input className="input" placeholder="Label if other" {...register(`${name}.${index}.label`)} />
            <input className="input" inputMode="decimal" placeholder="Amount" {...register(`${name}.${index}.amount`)} />
            <button type="button" className="btn-secondary" onClick={() => fields.remove(index)}>Remove</button>
          </div>
        ))}
        {fields.fields.length === 0 && <p className="text-xs text-slate-500">None added.</p>}
      </div>
    </div>
  );
}
