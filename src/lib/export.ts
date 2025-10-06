/**
 * Data export utilities
 * Export data to CSV, Excel, and other formats
 */

type CsvRow = Record<string, unknown>

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: CsvRow[], headers: string[]): string {
  if (!data || data.length === 0) return ''

  // Create header row
  const headerRow = headers.join(',')

  // Create data rows
  const dataRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header]
        // Escape commas and quotes
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      .join(',')
  })

  return [headerRow, ...dataRows].join('\n')
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: CsvRow[], headers: string[], filename: string): void {
  const csv = convertToCSV(data, headers)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export invoices to CSV
 */
export function exportInvoicesToCSV(invoices: CsvRow[]): void {
  const headers = [
    'invoice_number',
    'customer',
    'invoice_date',
    'due_date',
    'status',
    'subtotal',
    'tax_amount',
    'total_amount',
  ]

  const formattedData = invoices.map((inv) => {
    const companyName =
      (inv.companies as { name?: string | null } | null | undefined)?.name ?? 'N/A'

    return {
      invoice_number: inv.invoice_number,
      customer: companyName,
      invoice_date: new Date(String(inv.invoice_date)).toLocaleDateString('tr-TR'),
      due_date: inv.due_date ? new Date(String(inv.due_date)).toLocaleDateString('tr-TR') : '',
      status: inv.status,
      subtotal: Number(inv.subtotal ?? 0),
      tax_amount: Number(inv.tax_amount ?? 0),
      total_amount: Number((inv.total_amount ?? inv.total) ?? 0),
    }
  })

  const filename = `faturalar_${new Date().toISOString().split('T')[0]}`
  downloadCSV(formattedData, headers, filename)
}

/**
 * Export customers to CSV
 */
export function exportCustomersToCSV(customers: CsvRow[]): void {
  const headers = ['name', 'email', 'phone', 'address', 'tax_number']

  const formattedData = customers.map((customer) => ({
    name: String(customer.name ?? ''),
    email: String(customer.email ?? ''),
    phone: String(customer.phone ?? ''),
    address: String(customer.address ?? ''),
    tax_number: String(customer.tax_number ?? ''),
  }))

  const filename = `musteriler_${new Date().toISOString().split('T')[0]}`
  downloadCSV(formattedData, headers, filename)
}

/**
 * Export expenses to CSV
 */
export function exportExpensesToCSV(expenses: CsvRow[]): void {
  const headers = ['description', 'amount', 'expense_date', 'category', 'payment_method']

  const formattedData = expenses.map((expense) => ({
    description: String(expense.description ?? ''),
    amount: Number(expense.amount ?? 0),
    expense_date: new Date(String(expense.expense_date)).toLocaleDateString('tr-TR'),
    category:
      (expense.expense_categories as { name?: string } | null | undefined)?.name || 'N/A',
    payment_method: String(expense.payment_method ?? ''),
  }))

  const filename = `giderler_${new Date().toISOString().split('T')[0]}`
  downloadCSV(formattedData, headers, filename)
}

/**
 * Export chart of accounts to CSV
 */
export function exportAccountsToCSV(accounts: CsvRow[]): void {
  const headers = ['code', 'name', 'account_type', 'description', 'is_active']

  const formattedData = accounts.map((account) => ({
    code: account.code,
    name: account.name,
    account_type: account.account_type,
    description: account.description || '',
    is_active: account.is_active ? 'Aktif' : 'Pasif',
  }))

  const filename = `hesap_plani_${new Date().toISOString().split('T')[0]}`
  downloadCSV(formattedData, headers, filename)
}
