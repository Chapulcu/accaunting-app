import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ensureTurkishFont, setTurkishFont } from '@/lib/pdfFontLoader'

interface InvoiceData {
  invoice_number: string
  invoice_date: string
  due_date?: string
  status: string
  subtotal: number
  tax_amount: number
  total_amount: number
  notes?: string
  companies?: {
    name: string
    tax_number?: string
    address?: string
    phone?: string
    email?: string
  }
  invoice_items?: Array<{
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    total: number
  }>
}

interface CompanySettings {
  company_name?: string
  tax_number?: string
  address?: string
  phone?: string
  email?: string
  website?: string
}

const FONT_FAMILY = 'Roboto'

const formatCurrency = (value: number) =>
  `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`

export const generateInvoicePDF = async (
  invoice: InvoiceData,
  companySettings?: CompanySettings,
): Promise<jsPDF> => {
  const doc = new jsPDF({
    compress: false,
    putOnlyUsedFonts: true,
  })

  await ensureTurkishFont(doc)
  setTurkishFont(doc, 'normal')
  doc.setLanguage('tr')

  let yPos = 20

  doc.setFontSize(20)
  setTurkishFont(doc, 'bold')
  doc.text('FATURA', 105, yPos, { align: 'center' })
  yPos += 15

  doc.setFontSize(10)
  setTurkishFont(doc, 'bold')
  doc.text('Fatura Veren:', 20, yPos)
  yPos += 6

  setTurkishFont(doc, 'normal')
  if (companySettings?.company_name) {
    doc.text(companySettings.company_name, 20, yPos)
    yPos += 5
  }
  if (companySettings?.tax_number) {
    doc.text(`Vergi No: ${companySettings.tax_number}`, 20, yPos)
    yPos += 5
  }
  if (companySettings?.address) {
    const addressLines = doc.splitTextToSize(companySettings.address, 80)
    doc.text(addressLines, 20, yPos)
    yPos += addressLines.length * 5
  }
  if (companySettings?.phone) {
    doc.text(`Tel: ${companySettings.phone}`, 20, yPos)
    yPos += 5
  }
  if (companySettings?.email) {
    doc.text(`E-posta: ${companySettings.email}`, 20, yPos)
    yPos += 5
  }

  let rightYPos = 35
  setTurkishFont(doc, 'bold')
  doc.text('Fatura Edilen:', 120, rightYPos)
  rightYPos += 6

  setTurkishFont(doc, 'normal')
  if (invoice.companies?.name) {
    doc.text(invoice.companies.name, 120, rightYPos)
    rightYPos += 5
  }
  if (invoice.companies?.tax_number) {
    doc.text(`Vergi No: ${invoice.companies.tax_number}`, 120, rightYPos)
    rightYPos += 5
  }
  if (invoice.companies?.address) {
    const addressLines = doc.splitTextToSize(invoice.companies.address, 80)
    doc.text(addressLines, 120, rightYPos)
    rightYPos += addressLines.length * 5
  }
  if (invoice.companies?.phone) {
    doc.text(`Tel: ${invoice.companies.phone}`, 120, rightYPos)
    rightYPos += 5
  }

  rightYPos += 5
  setTurkishFont(doc, 'bold')
  doc.text('Fatura Bilgileri:', 120, rightYPos)
  rightYPos += 6

  setTurkishFont(doc, 'normal')
  doc.text(`Fatura No: ${invoice.invoice_number}`, 120, rightYPos)
  rightYPos += 5
  doc.text(`Tarih: ${new Date(invoice.invoice_date).toLocaleDateString('tr-TR')}`, 120, rightYPos)
  rightYPos += 5
  if (invoice.due_date) {
    doc.text(`Vade: ${new Date(invoice.due_date).toLocaleDateString('tr-TR')}`, 120, rightYPos)
    rightYPos += 5
  }

  const statusMap: Record<string, string> = {
    draft: 'Taslak',
    sent: 'Gönderildi',
    paid: 'Ödendi',
    cancelled: 'İptal',
  }
  doc.text(`Durum: ${statusMap[invoice.status] || invoice.status}`, 120, rightYPos)

  yPos = Math.max(yPos, rightYPos) + 10

  const tableData =
    invoice.invoice_items?.map((item) => [
      item.description,
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      `%${item.tax_rate}`,
      formatCurrency(item.total),
    ]) || []

  autoTable(doc, {
    startY: yPos,
    head: [['Açıklama', 'Miktar', 'Birim Fiyat', 'KDV', 'Toplam']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      font: FONT_FAMILY,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 35 },
    },
    styles: {
      font: FONT_FAMILY,
      fontSize: 9,
      cellPadding: 5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
  })

  const autoTableDoc = doc as jsPDF & {
    lastAutoTable?: {
      finalY: number
    }
  }

  const finalY = autoTableDoc.lastAutoTable?.finalY ?? yPos + 50
  yPos = finalY + 10

  const totalsX = 130
  doc.setFontSize(10)
  setTurkishFont(doc, 'normal')

  doc.text('Ara Toplam:', totalsX, yPos)
  doc.text(formatCurrency(invoice.subtotal), 190, yPos, { align: 'right' })
  yPos += 7

  doc.text('KDV:', totalsX, yPos)
  doc.text(formatCurrency(invoice.tax_amount), 190, yPos, { align: 'right' })
  yPos += 7

  setTurkishFont(doc, 'bold')
  doc.setFontSize(12)
  doc.text('Genel Toplam:', totalsX, yPos)
  doc.text(formatCurrency(invoice.total_amount), 190, yPos, { align: 'right' })

  if (invoice.notes) {
    yPos += 15
    setTurkishFont(doc, 'bold')
    doc.setFontSize(10)
    doc.text('Notlar:', 20, yPos)
    yPos += 6
    setTurkishFont(doc, 'normal')
    const notesLines = doc.splitTextToSize(invoice.notes, 170)
    doc.text(notesLines, 20, yPos)
  }

  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  setTurkishFont(doc, 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text('Bu belge elektronik ortamda oluşturulmuştur.', 105, pageHeight - 15, {
    align: 'center',
  })
  if (companySettings?.website) {
    doc.text(companySettings.website, 105, pageHeight - 10, { align: 'center' })
  }

  return doc
}

export const downloadInvoicePDF = async (
  invoice: InvoiceData,
  companySettings?: CompanySettings,
) => {
  const doc = await generateInvoicePDF(invoice, companySettings)
  const filename = `Fatura_${invoice.invoice_number}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

export const printInvoicePDF = async (
  invoice: InvoiceData,
  companySettings?: CompanySettings,
) => {
  const doc = await generateInvoicePDF(invoice, companySettings)
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)

  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

export const previewInvoicePDF = async (
  invoice: InvoiceData,
  companySettings?: CompanySettings,
): Promise<string> => {
  const doc = await generateInvoicePDF(invoice, companySettings)
  return doc.output('dataurlstring')
}
