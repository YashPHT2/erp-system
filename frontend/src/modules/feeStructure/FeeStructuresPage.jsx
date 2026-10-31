import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Pencil } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { feeService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatInr } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { FilterField, FilterPanel } from '../../components/FilterPanel';
import { Modal } from '../../components/Modal';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';
import { Pagination } from '../../components/Pagination';

const emptyForm = {
  academicYear: '',
  className: '',
  section: '',
  components: [{ code: 'TUITION', label: 'Tuition Fee', amount: '' }],
};

export function FeeStructuresPage() {
  const { can, meta } = useAuth();
  usePageMeta('Fee structure', 'Fee management');
  const [rows, setRows] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm({ defaultValues: emptyForm });
  const { fields, append, remove } = useFieldArray({ control, name: 'components' });
  const watched = watch('components');
  const total = (watched || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  async function load(nextPage = page) {
    setError('');
    try {
      const data = await feeService.listStructures({ page: nextPage, search, academicYear: year || undefined });
      setRows(data.items);
      setPage(data.page);
      setPages(data.pages);
    } catch (err) {
      setError(getErrorMessage(err));
      setRows([]);
    }
  }

  useEffect(() => {
    if (can('feeStructure.read')) load(1);
  }, [can, search, year]);

  function openCreate() {
    setEditing(null);
    reset({ ...emptyForm, academicYear: meta?.academicYear || '' });
    setFormError('');
    setOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    reset({
      academicYear: row.academicYear,
      className: row.className,
      section: row.section,
      components: row.components.map((item) => ({ ...item, amount: String(item.amount) })),
    });
    setFormError('');
    setOpen(true);
  }

  async function onSave(values) {
    setBusy(true);
    setFormError('');
    const body = {
      ...values,
      components: values.components.map((item) => ({
        code: item.code,
        label: item.label,
        amount: item.amount,
      })),
    };
    try {
      if (editing) await feeService.updateStructure(editing.id, body);
      else await feeService.createStructure(body);
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!can('feeStructure.read')) return <AccessDenied />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-500">Class fee plans for the academic year. The total is the sum of the components.</p>
        {can('feeStructure.write') && (
          <button type="button" className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New structure</button>
        )}
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <FilterPanel>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by class" />
        <FilterField label="Academic year">
          <select className="input" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All years</option>
            {(meta?.academicYears || []).map((item) => <option key={item}>{item}</option>)}
          </select>
        </FilterField>
      </FilterPanel>
      <div className="card">
        <DataTable
          isLoading={!rows}
          rows={rows || []}
          rowKey={(row) => row.id}
          emptyTitle="No fee structures"
          emptyDescription="A Super Admin or Principal can create the first class fee structure."
          columns={[
            { key: 'class', header: 'Class', render: (row) => <span className="font-medium text-slate-900">{row.className}</span> },
            { key: 'section', header: 'Section', render: (row) => row.section || 'All sections' },
            { key: 'year', header: 'Year', render: (row) => row.academicYear },
            { key: 'parts', header: 'Components', render: (row) => row.components.map((item) => item.label).join(', ') },
            { key: 'total', header: 'Total', align: 'right', render: (row) => formatInr(row.totalAmount) },
            { key: 'action', header: '', render: (row) => can('feeStructure.write') ? (
              <button type="button" className="btn-secondary h-8" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            ) : null },
          ]}
        />
        <Pagination page={page} pages={pages} onPage={load} />
      </div>

      <Modal open={open} title={editing ? 'Update fee structure' : 'New fee structure'} onClose={() => setOpen(false)} wide>
        <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Academic year</span>
              <select className="input" {...register('academicYear', { required: 'Choose an academic year' })}>
                <option value="">Select</option>
                {(meta?.academicYears || []).map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Class</span>
              <input className={`input ${errors.className ? 'input-error' : ''}`} {...register('className', { required: 'Class is required' })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Section</span>
              <input className="input" placeholder="Blank for all" {...register('section')} />
            </label>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
                <label className="block">
                  {index === 0 && <span className="mb-1.5 block text-sm font-medium text-slate-700">Component</span>}
                  <select className="input" {...register(`components.${index}.code`)}>
                    {(meta?.feeComponents || []).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  {index === 0 && <span className="mb-1.5 block text-sm font-medium text-slate-700">Label for other</span>}
                  <input className="input" placeholder="Only for other fees" {...register(`components.${index}.label`)} />
                </label>
                <label className="block">
                  {index === 0 && <span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span>}
                  <input className="input" inputMode="decimal" {...register(`components.${index}.amount`, { required: 'Required' })} />
                </label>
                <button type="button" className="btn-secondary" onClick={() => remove(index)} disabled={fields.length === 1}>Remove</button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button type="button" className="btn-secondary" onClick={() => append({ code: 'LIBRARY', label: '', amount: '' })}>Add component</button>
            <p className="text-sm text-slate-600">Total <span className="font-semibold tabular-nums text-slate-900">{formatInr(total)}</span></p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save structure'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
