import * as XLSX from 'xlsx'

interface ExportData {
  [key: string]: any
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('tr-TR')
}

const formatCurrency = (value: number) => {
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
}

export const exportToExcel = (
  data: ExportData[],
  filename: string,
  sheetName: string = 'Sayfa1'
) => {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export const exportInvoicesToExcel = (invoices: any[]) => {
  const data = invoices.map((invoice) => ({
    'Fatura No': invoice.invoice_number,
    'Müşteri': invoice.companies?.name || '-',
    'Tarih': formatDate(invoice.invoice_date),
    'Vade': invoice.due_date ? formatDate(invoice.due_date) : '-',
    'Ara Toplam': formatCurrency(invoice.subtotal),
    'KDV': formatCurrency(invoice.tax_amount),
    'Toplam': formatCurrency(invoice.total_amount),
    'Durum': invoice.status,
  }))

  const filename = `Faturalar_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Faturalar')
}

export const exportCompaniesToExcel = (companies: any[]) => {
  const data = companies.map((company) => ({
    'Şirket Adı': company.name,
    'Vergi No': company.tax_number || '-',
    'Telefon': company.phone || '-',
    'Email': company.email || '-',
    'Adres': company.address || '-',
    'Tip': company.type === 'customer' ? 'Müşteri' : company.type === 'supplier' ? 'Tedarikçi' : 'Her İkisi',
    'Durum': company.is_active ? 'Aktif' : 'Pasif',
  }))

  const filename = `Cariler_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Cariler')
}

export const exportExpensesToExcel = (expenses: any[]) => {
  const data = expenses.map((expense) => ({
    'Gider Adı': expense.description,
    'Kategori': expense.expense_categories?.name || '-',
    'Tutar': formatCurrency(expense.amount),
    'Tarih': formatDate(expense.expense_date),
    'Ödeme Yöntemi': expense.payment_method || '-',
    'Notlar': expense.notes || '-',
  }))

  const filename = `Giderler_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Giderler')
}

export const exportPaymentsToExcel = (payments: any[]) => {
  const data = payments.map((payment) => ({
    'Fatura No': payment.invoices?.invoice_number || '-',
    'Müşteri': payment.invoices?.companies?.name || '-',
    'Ödeme Tutarı': formatCurrency(payment.amount),
    'Ödeme Yöntemi': payment.payment_method,
    'Tarih': formatDate(payment.payment_date),
    'Notlar': payment.notes || '-',
  }))

  const filename = `Odemeler_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Ödemeler')
}

export const exportBankTransactionsToExcel = (transactions: any[]) => {
  const data = transactions.map((tx) => ({
    'Banka Hesabı': tx.bank_accounts?.bank_name || '-',
    'Tip': tx.transaction_type === 'deposit' ? 'Gelen' : 'Giden',
    'Tutar': formatCurrency(tx.amount),
    'Tarih': formatDate(tx.transaction_date),
    'Açıklama': tx.description || '-',
    'Referans': tx.reference_number || '-',
  }))

  const filename = `Banka_Hareketleri_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Banka Hareketleri')
}

export const exportCashTransactionsToExcel = (transactions: any[]) => {
  const data = transactions.map((tx) => ({
    'Kasa': tx.cash_registers?.name || '-',
    'Tip': tx.transaction_type === 'income' ? 'Gelir' : 'Gider',
    'Tutar': formatCurrency(tx.amount),
    'Tarih': formatDate(tx.transaction_date),
    'Açıklama': tx.description || '-',
  }))

  const filename = `Kasa_Hareketleri_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Kasa Hareketleri')
}

export const exportBalanceSheetToExcel = (data: {
  assets: any[]
  liabilities: any[]
  equity: any[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}) => {
  const assetRows = data.assets.map((item) => ({
    'Hesap Türü': 'Aktifler',
    'Hesap Kodu': item.code,
    'Hesap Adı': item.name,
    'Bakiye': formatCurrency(item.balance),
  }))

  const liabilityRows = data.liabilities.map((item) => ({
    'Hesap Türü': 'Pasifler',
    'Hesap Kodu': item.code,
    'Hesap Adı': item.name,
    'Bakiye': formatCurrency(item.balance),
  }))

  const equityRows = data.equity.map((item) => ({
    'Hesap Türü': 'Özsermaye',
    'Hesap Kodu': item.code,
    'Hesap Adı': item.name,
    'Bakiye': formatCurrency(item.balance),
  }))

  const summaryRows = [
    { 'Hesap Türü': '', 'Hesap Kodu': '', 'Hesap Adı': '', 'Bakiye': '' },
    {
      'Hesap Türü': 'TOPLAM',
      'Hesap Kodu': '',
      'Hesap Adı': 'Toplam Aktifler',
      'Bakiye': formatCurrency(data.totalAssets),
    },
    {
      'Hesap Türü': 'TOPLAM',
      'Hesap Kodu': '',
      'Hesap Adı': 'Toplam Pasifler',
      'Bakiye': formatCurrency(data.totalLiabilities),
    },
    {
      'Hesap Türü': 'TOPLAM',
      'Hesap Kodu': '',
      'Hesap Adı': 'Toplam Özsermaye',
      'Bakiye': formatCurrency(data.totalEquity),
    },
  ]

  const allRows = [...assetRows, ...liabilityRows, ...equityRows, ...summaryRows]

  const filename = `Bilanco_${new Date().toISOString().split('T')[0]}`
  exportToExcel(allRows, filename, 'Bilanço')
}

export const exportTrialBalanceToExcel = (accounts: any[]) => {
  const data = accounts.map((account) => ({
    'Hesap Kodu': account.code,
    'Hesap Adı': account.name,
    'Borç': account.debit ? formatCurrency(account.debit) : '-',
    'Alacak': account.credit ? formatCurrency(account.credit) : '-',
    'Bakiye': formatCurrency(account.balance),
  }))

  const filename = `Mizan_${new Date().toISOString().split('T')[0]}`
  exportToExcel(data, filename, 'Mizan')
}
