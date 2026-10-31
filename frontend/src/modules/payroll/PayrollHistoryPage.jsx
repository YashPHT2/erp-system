import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { payrollService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatDate, formatInr } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { FilterField, FilterPanel } from '../../components/FilterPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';

export function PayrollHistoryPage() {
  const { can } = useAuth();
  usePageMeta('Payroll history', 'Payroll');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load(page = 1) {
    try {
      setData(await payrollService.list({ page, search, status, sort }));
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    if (can('payroll.read')) load(1);
  }, [can, search, status, sort]);

  async function markPaid(id) {
    try {
      await payrollService.markPaid(id);
      await load(data?.page || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!can('payroll.read')) return <AccessDenied />;

  return (
    <div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <FilterPanel>
        <SearchBar value={search} onChange={setSearch} placeholder="Employee name or ID" />
        <FilterField label="Status">
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="processed">Processed</option>
            <option value="paid">Paid</option>
          </select>
        </FilterField>
        <FilterField label="Sort">
          <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="net">Net salary</option>
          </select>
        </FilterField>
      </FilterPanel>
      <div className="card">
        <DataTable
          isLoading={!data}
          rows={data?.items || []}
          rowKey={(row) => row.id}
          emptyTitle="No payroll records"
          columns={[
            { key: 'employee', header: 'Employee', render: (row) => (
              <div>
                <p className="font-medium text-slate-900">{row.employeeName}</p>
                <p className="text-xs text-slate-500">{row.employeeCode}</p>
              </div>
            ) },
            { key: 'period', header: 'Period', render: (row) => row.periodLabel },
            { key: 'basic', header: 'Basic', align: 'right', render: (row) => formatInr(row.basicSalary) },
            { key: 'allowances', header: 'Allowances', align: 'right', render: (row) => formatInr(row.totalAllowances) },
            { key: 'deductions', header: 'Deductions', align: 'right', render: (row) => formatInr(row.totalDeductions) },
            { key: 'net', header: 'Net', align: 'right', render: (row) => formatInr(row.netSalary) },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'paid', header: 'Paid on', render: (row) => formatDate(row.paidAt) },
            { key: 'action', header: '', render: (row) => (
              <div className="flex justify-end gap-2">
                <Link className="btn-secondary h-8" to={`/payroll/slips/${row.id}`}>Slip</Link>
                {row.status === 'processed' && can('payroll.write') && (
                  <button type="button" className="btn-primary h-8" onClick={() => markPaid(row.id)}>Mark paid</button>
                )}
              </div>
            ) },
          ]}
        />
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={load} />
      </div>
    </div>
  );
}
