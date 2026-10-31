import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { FeeStructuresPage } from './modules/feeStructure/FeeStructuresPage';
import { CollectFeePage } from './modules/feeCollection/CollectFeePage';
import { PaymentHistoryPage } from './modules/feeCollection/PaymentHistoryPage';
import { ReceiptsPage } from './modules/receipts/ReceiptsPage';
import { ReceiptDetailPage } from './modules/receipts/ReceiptDetailPage';
import { PendingFeesPage } from './modules/feeReports/PendingFeesPage';
import { DefaultersPage } from './modules/feeReports/DefaultersPage';
import { ReportsPage } from './modules/feeReports/ReportsPage';
import { SalaryProfilesPage } from './modules/payroll/SalaryProfilesPage';
import { ProcessPayrollPage } from './modules/payroll/ProcessPayrollPage';
import { PayrollHistoryPage } from './modules/payroll/PayrollHistoryPage';
import { SalarySlipsPage } from './modules/payroll/SalarySlipsPage';
import { SalarySlipPage } from './modules/payroll/SalarySlipPage';
import { SettingsPage } from './modules/settings/SettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/fees/structures" element={<FeeStructuresPage />} />
              <Route path="/fees/collect" element={<CollectFeePage />} />
              <Route path="/fees/payments" element={<PaymentHistoryPage />} />
              <Route path="/fees/receipts" element={<ReceiptsPage />} />
              <Route path="/fees/receipts/:id" element={<ReceiptDetailPage />} />
              <Route path="/fees/pending" element={<PendingFeesPage />} />
              <Route path="/fees/defaulters" element={<DefaultersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/payroll/salaries" element={<SalaryProfilesPage />} />
              <Route path="/payroll/process" element={<ProcessPayrollPage />} />
              <Route path="/payroll/history" element={<PayrollHistoryPage />} />
              <Route path="/payroll/slips" element={<SalarySlipsPage />} />
              <Route path="/payroll/slips/:id" element={<SalarySlipPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
