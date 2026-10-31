import { reportService } from '../../services/financeService';
import { BalanceReportPage } from './BalanceReportPage';

export function DefaultersPage() {
  return (
    <BalanceReportPage
      title="Defaulters"
      loader={reportService.defaulters}
      exportPath="/reports/defaulters"
      exportName="defaulters.csv"
      onlyDefaulters
    />
  );
}
