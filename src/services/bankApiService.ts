/**
 * Banka API Servisi - Türk Bankaları Entegrasyon Katmanı
 *
 * Bu servis farklı banka API'lerini soyutlar ve ortak interface sağlar.
 * Desteklenen bankalar: İş Bankası, Garanti, YapıKredi, Akbank
 */

import { supabase } from '@/lib/supabase'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BankProvider = 'isbank' | 'garanti' | 'yapikredi' | 'akbank' | 'mock'

export interface BankCredentials {
  provider: BankProvider
  customerNumber?: string
  username?: string
  password?: string
  apiKey?: string
  certificatePath?: string
}

export interface BankTransaction {
  externalId: string
  date: string
  description: string
  amount: number
  type: 'deposit' | 'withdrawal'
  balance: number
  valueDate?: string
  referenceNumber?: string
  rawData?: any
}

export interface BankBalance {
  available: number
  current: number
  currency: string
  asOf: string
}

export interface SyncResult {
  success: boolean
  transactionsFetched: number
  transactionsImported: number
  transactionsSkipped: number
  error?: string
}

// ============================================================================
// ABSTRACT BANK PROVIDER
// ============================================================================

export abstract class BankApiProvider {
  protected credentials: BankCredentials

  constructor(credentials: BankCredentials) {
    this.credentials = credentials
  }

  /**
   * API'ye bağlan ve access token al
   */
  abstract connect(): Promise<{ accessToken: string; expiresIn: number }>

  /**
   * Hesap bakiyesini getir
   */
  abstract getBalance(accountNumber: string): Promise<BankBalance>

  /**
   * Belirli tarih aralığındaki işlemleri getir
   */
  abstract getTransactions(
    accountNumber: string,
    startDate: Date,
    endDate: Date
  ): Promise<BankTransaction[]>

  /**
   * Token'ı yenile
   */
  abstract refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>
}

// ============================================================================
// MOCK PROVIDER (Development/Testing)
// ============================================================================

export class MockBankProvider extends BankApiProvider {
  async connect(): Promise<{ accessToken: string; expiresIn: number }> {
    await new Promise((resolve) => setTimeout(resolve, 500))

    return {
      accessToken: 'mock_access_token_' + Date.now(),
      expiresIn: 3600,
    }
  }

  async getBalance(_accountNumber: string): Promise<BankBalance> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    return {
      available: 150000 + Math.random() * 50000,
      current: 150000 + Math.random() * 50000,
      currency: 'TRY',
      asOf: new Date().toISOString(),
    }
  }

  async getTransactions(
    _accountNumber: string,
    startDate: Date,
    endDate: Date
  ): Promise<BankTransaction[]> {
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Mock transactions
    const transactions: BankTransaction[] = []
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    for (let i = 0; i < Math.min(daysDiff, 10); i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)

      if (Math.random() > 0.3) {
        transactions.push({
          externalId: `MOCK-${Date.now()}-${i}`,
          date: date.toISOString().split('T')[0],
          description: this.getRandomDescription(),
          amount: Math.floor(Math.random() * 10000) + 100,
          type: Math.random() > 0.5 ? 'deposit' : 'withdrawal',
          balance: 150000 + Math.random() * 50000,
          referenceNumber: `REF${Math.floor(Math.random() * 999999)}`,
        })
      }
    }

    return transactions
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return {
      accessToken: 'mock_refreshed_token_' + Date.now(),
      expiresIn: 3600,
    }
  }

  private getRandomDescription(): string {
    const descriptions = [
      'POS İŞLEMİ - MARKET ALIŞ',
      'HAVALE GİDEN - KIRA ÖDEMESİ',
      'MAAŞ YATIŞI',
      'EFT GİDEN - FATURA ÖDEMESİ',
      'POS İŞLEMİ - RESTAURANT',
      'HAVALE GELEN - FATURA TAHSİLATI',
      'ATM PARA ÇEKME',
      'FAİZ GELİRİ',
    ]
    return descriptions[Math.floor(Math.random() * descriptions.length)]
  }
}

// ============================================================================
// İŞ BANKASI PROVIDER
// ============================================================================

export class IsBankProvider extends BankApiProvider {
  private baseURL: string
  private accessToken?: string

  constructor(credentials: BankCredentials) {
    super(credentials)
    this.baseURL = 'https://apiportal.isbank.com.tr' // Test environment
  }

  async connect(): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // İş Bankası OAuth2 flow
      const response = await fetch(`${this.baseURL}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'accounts transactions',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error_description || 'Bağlantı başarısız')
      }

      this.accessToken = data.access_token

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'İş Bankası bağlantısı başarısız')
    }
  }

  async getBalance(accountNumber: string): Promise<BankBalance> {
    if (!this.accessToken) await this.connect()

    const response = await fetch(`${this.baseURL}/v1/accounts/${accountNumber}/balance`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return {
      available: parseFloat(data.availableBalance),
      current: parseFloat(data.currentBalance),
      currency: data.currency || 'TRY',
      asOf: data.balanceDate,
    }
  }

  async getTransactions(
    accountNumber: string,
    startDate: Date,
    endDate: Date
  ): Promise<BankTransaction[]> {
    if (!this.accessToken) await this.connect()

    const response = await fetch(
      `${this.baseURL}/v1/accounts/${accountNumber}/transactions?` +
        new URLSearchParams({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        }),
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()

    return data.transactions.map((t: any) => ({
      externalId: t.transactionId,
      date: t.transactionDate,
      description: t.description,
      amount: Math.abs(parseFloat(t.amount)),
      type: parseFloat(t.amount) > 0 ? 'deposit' : 'withdrawal',
      balance: parseFloat(t.balanceAfter),
      valueDate: t.valueDate,
      referenceNumber: t.referenceNumber,
      rawData: t,
    }))
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch(`${this.baseURL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    const data = await response.json()

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBankProvider(credentials: BankCredentials): BankApiProvider {
  switch (credentials.provider) {
    case 'isbank':
      return new IsBankProvider(credentials)
    case 'garanti':
      throw new Error('Garanti entegrasyonu henüz hazır değil')
    case 'yapikredi':
      throw new Error('YapıKredi entegrasyonu henüz hazır değil')
    case 'akbank':
      throw new Error('Akbank entegrasyonu henüz hazır değil')
    case 'mock':
    default:
      return new MockBankProvider(credentials)
  }
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

export const BankApiService = {
  /**
   * Banka hesabını senkronize et
   */
  async syncBankAccount(
    userId: string,
    bankAccountId: number,
    startDate: Date,
    endDate: Date
  ): Promise<SyncResult> {
    try {
      // 1. Banka hesabı ve credentials bilgilerini çek
      const { data: bankAccount, error: accountError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', bankAccountId)
        .eq('user_id', userId)
        .single()

      if (accountError || !bankAccount) throw new Error('Banka hesabı bulunamadı')

      const { data: credentials, error: credError } = await supabase
        .from('bank_api_credentials')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .eq('user_id', userId)
        .single()

      if (credError || !credentials) throw new Error('API kimlik bilgileri bulunamadı')

      // 2. Provider oluştur
      const provider = createBankProvider({
        provider: credentials.provider as BankProvider,
        customerNumber: credentials.customer_number,
        username: credentials.username,
        apiKey: credentials.api_key,
      })

      // 3. Token kontrolü ve yenileme
      if (credentials.access_token && credentials.token_expires_at) {
        const expiresAt = new Date(credentials.token_expires_at)
        if (expiresAt < new Date()) {
          // Token expired, refresh it
          const { accessToken, expiresIn } = await provider.refreshToken(
            credentials.refresh_token
          )

          await supabase
            .from('bank_api_credentials')
            .update({
              access_token: accessToken,
              token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            })
            .eq('id', credentials.id)
        }
      }

      // 4. İşlemleri çek
      const transactions = await provider.getTransactions(
        bankAccount.account_number || bankAccount.iban,
        startDate,
        endDate
      )

      let imported = 0
      let skipped = 0

      // 5. İşlemleri database'e kaydet
      for (const transaction of transactions) {
        // Daha önce import edilmiş mi kontrol et
        const { data: existing } = await supabase
          .from('bank_transactions')
          .select('id')
          .eq('bank_account_id', bankAccountId)
          .eq('external_id', transaction.externalId)
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        // Yeni işlem ekle
        const { error: insertError } = await supabase.from('bank_transactions').insert({
          user_id: userId,
          bank_account_id: bankAccountId,
          transaction_date: transaction.date,
          transaction_type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          reference_number: transaction.referenceNumber,
          balance_after: transaction.balance,
          source: 'api',
          external_id: transaction.externalId,
          raw_data: transaction.rawData,
        })

        if (!insertError) {
          imported++
        }
      }

      // 6. Last sync date güncelle
      await supabase
        .from('bank_accounts')
        .update({ last_sync_date: new Date().toISOString() })
        .eq('id', bankAccountId)

      // 7. Sync log kaydet
      await supabase.from('bank_sync_logs').insert({
        user_id: userId,
        bank_account_id: bankAccountId,
        status: 'success',
        transactions_fetched: transactions.length,
        transactions_imported: imported,
        transactions_skipped: skipped,
      })

      return {
        success: true,
        transactionsFetched: transactions.length,
        transactionsImported: imported,
        transactionsSkipped: skipped,
      }
    } catch (error) {
      // Hata logu kaydet
      await supabase.from('bank_sync_logs').insert({
        user_id: userId,
        bank_account_id: bankAccountId,
        status: 'failed',
        transactions_fetched: 0,
        transactions_imported: 0,
        transactions_skipped: 0,
        error_message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      })

      return {
        success: false,
        transactionsFetched: 0,
        transactionsImported: 0,
        transactionsSkipped: 0,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      }
    }
  },

  /**
   * Bakiye güncelle
   */
  async updateBalance(userId: string, bankAccountId: number): Promise<BankBalance> {
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('user_id', userId)
      .single()

    if (!bankAccount) throw new Error('Banka hesabı bulunamadı')

    const { data: credentials } = await supabase
      .from('bank_api_credentials')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .single()

    if (!credentials) throw new Error('API kimlik bilgileri bulunamadı')

    const provider = createBankProvider({
      provider: credentials.provider as BankProvider,
      customerNumber: credentials.customer_number,
      username: credentials.username,
      apiKey: credentials.api_key,
    })

    const balance = await provider.getBalance(
      bankAccount.account_number || bankAccount.iban
    )

    // Database'de bakiyeyi güncelle
    await supabase
      .from('bank_accounts')
      .update({ current_balance: balance.current })
      .eq('id', bankAccountId)

    return balance
  },
}
