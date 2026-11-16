import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { SetupPage, ForgotPasswordPage, ResetPasswordPage, ChangePasswordPage } from './pages/AccountPages';
import { DirectoryPage } from './modules/directory/DirectoryPage';
import { UsersPage } from './modules/settings/UsersPage';
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
import { TeacherDashboardPage } from './modules/teaching/TeacherDashboardPage';
import { TeachingManagementPage } from './modules/teaching/TeachingManagementPage';
import { LibraryPage } from './modules/library/LibraryPage';
import { StudentDashboardPage } from './modules/student/StudentDashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/library" element={<LibraryPage />} />
              {['books','circulation','my-books'].map(tab=><Route key={tab} path={`/library/${tab}`} element={<LibraryPage tab={tab}/>} />)}
              {['fees','payments','receipts'].map(tab => <Route key={tab} path={`/student/${tab}`} element={<StudentDashboardPage tab={tab} />} />)}
              <Route path="/student/receipts/:id" element={<ReceiptDetailPage student />} />
              {['salary', 'sections', 'timetable', 'attendance', 'assignments'].map(tab => <Route key={tab} path={`/teacher/${tab}`} element={<TeacherDashboardPage tab={tab} />} />)}
              <Route path="/teacher/salary-slips/:id" element={<SalarySlipPage teacher />} />
              <Route path="/teaching/manage" element={<TeachingManagementPage />} />
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
              <Route path="/account/password" element={<ChangePasswordPage />} />
              <Route path="/settings/users" element={<UsersPage />} />
              <Route path="/directory/students" element={<DirectoryPage kind="students" key="students" />} />
              <Route path="/directory/employees" element={<DirectoryPage kind="employees" key="employees" />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
