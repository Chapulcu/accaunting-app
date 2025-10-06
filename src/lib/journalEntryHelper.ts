import { supabase } from './supabase'

interface JournalEntryLine {
  account_id: string
  debit: number
  credit: number
  description: string | null
}

interface CreateJournalEntryParams {
  user_id: string
  entry_date: string
  description: string
  reference_type: 'invoice' | 'payment' | 'expense'
  reference_id: number
  lines: JournalEntryLine[]
  notes?: string
}

/**
 * Otomatik yevmiye kaydı oluşturur
 */
export async function createAutoJournalEntry(params: CreateJournalEntryParams) {
  const { user_id, entry_date, description, reference_type, reference_id, lines, notes } = params

  // Toplam borç ve alacak hesapla
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0)

  // Borç ve alacak eşit olmalı
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Borç ve alacak eşit değil. Borç: ${totalDebit}, Alacak: ${totalCredit}`)
  }

  // Yevmiye numarası oluştur
  const { data: lastEntry } = await supabase
    .from('journal_entries')
    .select('entry_number')
    .eq('user_id', user_id)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle() // .single() yerine .maybeSingle() kullan - ilk kayıtta hata vermesin

  const lastNumber = lastEntry?.entry_number ? parseInt(lastEntry.entry_number.split('-')[1]) : 0
  const entryNumber = `YEV-${String(lastNumber + 1).padStart(6, '0')}`

  // Yevmiye kaydı oluştur (önce draft olarak)
  const { data: journalEntry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      user_id,
      entry_date,
      entry_number: entryNumber,
      description,
      reference_type,
      reference_id,
      status: 'draft', // Önce draft olarak oluştur
      total_debit: totalDebit,
      total_credit: totalCredit,
      notes: notes || null,
      created_by: user_id,
    })
    .select()
    .single()

  if (entryError) throw entryError

  // Satırları ekle
  const linesToInsert = lines.map(line => ({
    journal_entry_id: journalEntry.id,
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
    description: line.description,
  }))

  const { error: linesError } = await supabase
    .from('journal_entry_lines')
    .insert(linesToInsert)

  if (linesError) throw linesError

  // Şimdi posted durumuna geçir
  const { error: postError } = await supabase
    .from('journal_entries')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString()
    })
    .eq('id', journalEntry.id)

  if (postError) throw postError

  return journalEntry
}

/**
 * Hesap kodundan hesap ID'sini bulur
 */
export async function getAccountIdByCode(userId: string, code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error(`Hesap bulunamadı: ${code}`, error)
    return null
  }

  return data?.id || null
}

/**
 * Fatura için yevmiye kaydı oluşturur
 * Borç: 120 - ALICILAR (Müşteriden Alacak)
 * Alacak: 600 - YURTIÇI SATIŞLAR (Satış Geliri)
 * Alacak: 391 - HESAPLANAN KDV (KDV Borcu)
 */
export async function createInvoiceJournalEntry(
  userId: string,
  invoiceId: number,
  invoiceDate: string,
  customerName: string,
  subtotal: number,
  vatAmount: number,
  total: number
) {
  // Hesap ID'lerini bul
  const alicilarId = await getAccountIdByCode(userId, '120') // ALICILAR
  const satislarId = await getAccountIdByCode(userId, '600') // YURTIÇI SATIŞLAR
  const kdvId = await getAccountIdByCode(userId, '391') // HESAPLANAN KDV

  if (!alicilarId || !satislarId || !kdvId) {
    throw new Error('Gerekli hesaplar bulunamadı. Lütfen hesap planını kontrol edin.')
  }

  const lines: JournalEntryLine[] = [
    {
      account_id: alicilarId,
      debit: total,
      credit: 0,
      description: `${customerName} - Fatura`,
    },
    {
      account_id: satislarId,
      debit: 0,
      credit: subtotal,
      description: 'Satış geliri',
    },
    {
      account_id: kdvId,
      debit: 0,
      credit: vatAmount,
      description: 'Hesaplanan KDV',
    },
  ]

  return createAutoJournalEntry({
    user_id: userId,
    entry_date: invoiceDate,
    description: `Fatura - ${customerName}`,
    reference_type: 'invoice',
    reference_id: invoiceId,
    lines,
    notes: 'Otomatik oluşturulan fatura kaydı',
  })
}

/**
 * Ödeme için yevmiye kaydı oluşturur
 * Borç: 100 - KASA veya 102 - BANKALAR
 * Alacak: 120 - ALICILAR (Alacağın tahsili)
 */
export async function createPaymentJournalEntry(
  userId: string,
  paymentId: number,
  paymentDate: string,
  customerName: string,
  amount: number,
  paymentMethod: 'cash' | 'bank' | 'credit_card'
) {
  // Ödeme yöntemine göre hesap seç
  let debitAccountCode = '100' // KASA (default)
  if (paymentMethod === 'bank' || paymentMethod === 'credit_card') {
    debitAccountCode = '102' // BANKALAR
  }

  const debitAccountId = await getAccountIdByCode(userId, debitAccountCode)
  const alicilarId = await getAccountIdByCode(userId, '120') // ALICILAR

  if (!debitAccountId || !alicilarId) {
    throw new Error('Gerekli hesaplar bulunamadı. Lütfen hesap planını kontrol edin.')
  }

  const lines: JournalEntryLine[] = [
    {
      account_id: debitAccountId,
      debit: amount,
      credit: 0,
      description: paymentMethod === 'cash' ? 'Nakit tahsilat' : 'Banka tahsilat',
    },
    {
      account_id: alicilarId,
      debit: 0,
      credit: amount,
      description: `${customerName} - Tahsilat`,
    },
  ]

  return createAutoJournalEntry({
    user_id: userId,
    entry_date: paymentDate,
    description: `Tahsilat - ${customerName}`,
    reference_type: 'payment',
    reference_id: paymentId,
    lines,
    notes: 'Otomatik oluşturulan ödeme kaydı',
  })
}

/**
 * Gider için yevmiye kaydı oluşturur
 * Borç: 7xx - GİDER HESAPLARI
 * Borç: 191 - İNDİRİLECEK KDV (varsa)
 * Alacak: 100 - KASA veya 102 - BANKALAR
 */
export async function createExpenseJournalEntry(
  userId: string,
  expenseId: number,
  expenseDate: string,
  description: string,
  amount: number,
  vatAmount: number,
  paymentMethod: 'cash' | 'bank' | 'credit_card'
) {
  // Kategori bazlı gider hesabı
  const expenseAccountCode = '730' // GENEL YÖNETİM GİDERLERİ (default)

  const expenseAccountId = await getAccountIdByCode(userId, expenseAccountCode)
  const indirilebilirKdvId = await getAccountIdByCode(userId, '191') // İNDİRİLECEK KDV

  let creditAccountCode = '100' // KASA (default)
  if (paymentMethod === 'bank' || paymentMethod === 'credit_card') {
    creditAccountCode = '102' // BANKALAR
  }
  const creditAccountId = await getAccountIdByCode(userId, creditAccountCode)

  if (!expenseAccountId || !creditAccountId) {
    throw new Error('Gerekli hesaplar bulunamadı. Lütfen hesap planını kontrol edin.')
  }

  const lines: JournalEntryLine[] = [
    {
      account_id: expenseAccountId,
      debit: amount - vatAmount,
      credit: 0,
      description: description,
    },
  ]

  // KDV varsa ekle
  if (vatAmount > 0 && indirilebilirKdvId) {
    lines.push({
      account_id: indirilebilirKdvId,
      debit: vatAmount,
      credit: 0,
      description: 'İndirilecek KDV',
    })
  }

  lines.push({
    account_id: creditAccountId,
    debit: 0,
    credit: amount,
    description: paymentMethod === 'cash' ? 'Nakit ödeme' : 'Banka ödemesi',
  })

  return createAutoJournalEntry({
    user_id: userId,
    entry_date: expenseDate,
    description: `Gider - ${description}`,
    reference_type: 'expense',
    reference_id: expenseId,
    lines,
    notes: 'Otomatik oluşturulan gider kaydı',
  })
}
