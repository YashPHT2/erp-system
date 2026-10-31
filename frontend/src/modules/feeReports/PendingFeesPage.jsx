import { reportService } from '../../services/financeService';
import { BalanceReportPage } from './BalanceReportPage';

export function PendingFeesPage() {
  return (
    <BalanceReportPage
      title="Pending fees"
      loader={reportService.pending}
      exportPath="/reports/pending"
      exportName="pending-fees.csv"
    />
  );
}
