import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePageMeta } from '../../hooks/usePageMeta';
import { payrollService } from '../../services/financeService';
import { getErrorMessage } from '../../services/api';
import { formatInr } from '../../utils/format';
import { DataTable } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Alert } from '../../components/Alert';
import { AccessDenied } from '../../components/AccessDenied';

export function SalarySlipsPage() {
  const { can } = useAuth();
  usePageMeta('Salary slips', 'Payroll');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!can('payroll.read')) return;
    payrollService.list({ search, limit: 20 })
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)));
  }, [can, search]);

  if (!can('payroll.read')) return <AccessDenied />;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">Open a processed payroll record to print the salary slip.</p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="mb-4 max-w-md"><SearchBar value={search} onChange={setSearch} placeholder="Search employee" /></div>
      <div className="card">
        <DataTable
          isLoading={!data}
          rows={data?.items || []}
          rowKey={(row) => row.id}
          emptyTitle="No salary slips"
          columns={[
            { key: 'employee', header: 'Employee', render: (row) => row.employeeName },
            { key: 'code', header: 'Employee ID', render: (row) => row.employeeCode },
            { key: 'period', header: 'Period', render: (row) => row.periodLabel },
            { key: 'net', header: 'Net salary', align: 'right', render: (row) => formatInr(row.netSalary) },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'open', header: '', render: (row) => <Link className="font-medium text-blue-700" to={`/payroll/slips/${row.id}`}>View slip</Link> },
          ]}
        />
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={(page) => payrollService.list({ search, page }).then(setData)} />
      </div>
    </div>
  );
}
