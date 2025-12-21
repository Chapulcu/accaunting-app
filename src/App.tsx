import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Customers from '@/pages/Customers'
import Invoices from '@/pages/Invoices'
import Payments from '@/pages/Payments'
import Expenses from '@/pages/Expenses'
import Products from '@/pages/Products'
import ExchangeRates from '@/pages/ExchangeRates'
import Accounts from '@/pages/Accounts'
import ReportsHub from '@/pages/ReportsHub'
import BalanceSheet from '@/pages/reports/BalanceSheet'
import TrialBalance from '@/pages/reports/TrialBalance'
import IncomeStatement from '@/pages/reports/IncomeStatement'
import CustomerAccountSummary from '@/pages/reports/CustomerAccountSummary'
import VATDeclaration from '@/pages/reports/VATDeclaration'
import AgingAnalysis from '@/pages/reports/AgingAnalysis'
import Settings from '@/pages/Settings'
import EmailHistory from '@/pages/EmailHistory'
import RecurringInvoices from '@/pages/RecurringInvoices'
import JournalEntries from '@/pages/JournalEntries'
import PeriodClose from '@/pages/PeriodClose'
import EInvoiceSettings from '@/pages/EInvoiceSettings'
import EInvoices from '@/pages/EInvoices'
import EArchiveSettings from '@/pages/EArchiveSettings'
import BankAccounts from '@/pages/BankAccounts'
import RolesPermissions from '@/pages/RolesPermissions'
import UsersManagement from '@/pages/UsersManagement'
import Reminders from '@/pages/Reminders'
import ApprovalWorkflows from '@/pages/ApprovalWorkflows'
import OrganizationSettings from '@/pages/OrganizationSettings'
import OrganizationMembers from '@/pages/OrganizationMembers'
import AcceptInvitation from '@/pages/AcceptInvitation'
import N8nWorkflows from '@/pages/automation/N8nWorkflows'
import OCRHistory from '@/pages/OCRHistory'
import AIFeedbackAnalytics from '@/pages/AIFeedbackAnalytics'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="recurring-invoices" element={<RecurringInvoices />} />
              <Route path="payments" element={<Payments />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="products" element={<Products />} />
              <Route path="exchange-rates" element={<ExchangeRates />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="journal-entries" element={<JournalEntries />} />
              <Route path="period-close" element={<PeriodClose />} />
              <Route path="reports" element={<ReportsHub />} />
              <Route path="reports/income-statement" element={<IncomeStatement />} />
              <Route path="reports/balance-sheet" element={<BalanceSheet />} />
              <Route path="reports/trial-balance" element={<TrialBalance />} />
              <Route path="reports/customer-account-summary" element={<CustomerAccountSummary />} />
              <Route path="reports/vat-declaration" element={<VATDeclaration />} />
              <Route path="reports/aging-analysis" element={<AgingAnalysis />} />
              <Route path="email-history" element={<EmailHistory />} />
              <Route path="e-invoice-settings" element={<EInvoiceSettings />} />
              <Route path="e-invoices" element={<EInvoices />} />
              <Route path="e-archive-settings" element={<EArchiveSettings />} />
              <Route path="bank-accounts" element={<BankAccounts />} />
              <Route path="roles-permissions" element={<RolesPermissions />} />
              <Route path="users-management" element={<UsersManagement />} />
              <Route path="approval-workflows" element={<ApprovalWorkflows />} />
              <Route path="reminders" element={<Reminders />} />
              <Route path="organization-settings" element={<OrganizationSettings />} />
              <Route path="organization-members" element={<OrganizationMembers />} />
              <Route path="automation/n8n-workflows" element={<N8nWorkflows />} />
              <Route path="ocr-history" element={<OCRHistory />} />
              <Route path="ai-feedback-analytics" element={<AIFeedbackAnalytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
