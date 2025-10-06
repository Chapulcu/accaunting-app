type GenericTable = {
  Row: Record<string, any>
  Insert: Record<string, any>
  Update: Record<string, any>
}

type GenericView = {
  Row: Record<string, any>
}

type GenericFunction = {
  Args: Record<string, any>
  Returns: any
}

export type Database = {
  public: {
    Tables: ({
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'user' | 'accountant' | 'admin'
          company_name: string | null
          tax_number: string | null
          phone: string | null
          address: string | null
          language: 'tr' | 'en'
          preferences: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'accountant' | 'admin'
          company_name?: string | null
          tax_number?: string | null
          phone?: string | null
          address?: string | null
          language?: 'tr' | 'en'
          preferences?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'accountant' | 'admin'
          company_name?: string | null
          tax_number?: string | null
          phone?: string | null
          address?: string | null
          language?: 'tr' | 'en'
          preferences?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: number
          user_id: string
          name: string
          type: 'customer' | 'supplier' | 'both'
          tax_number: string | null
          tax_office: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          address: string | null
          city: string | null
          country: string | null
          postal_code: string | null
          website: string | null
          contact_person: string | null
          notes: string | null
          is_active: boolean
          balance: number
          currency: 'TRY' | 'USD' | 'EUR' | 'GBP'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          name: string
          type: 'customer' | 'supplier' | 'both'
          tax_number?: string | null
          tax_office?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          website?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
          balance?: number
          currency?: 'TRY' | 'USD' | 'EUR' | 'GBP'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          name?: string
          type?: 'customer' | 'supplier' | 'both'
          tax_number?: string | null
          tax_office?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          website?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
          balance?: number
          currency?: 'TRY' | 'USD' | 'EUR' | 'GBP'
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: number
          user_id: string
          company_id: number | null
          invoice_type: 'sales' | 'purchase'
          invoice_number: string
          invoice_date: string
          due_date: string | null
          description: string | null
          subtotal: number
          tax_amount: number
          discount_amount: number
          total_amount: number
          currency: 'TRY' | 'USD' | 'EUR' | 'GBP'
          exchange_rate: number
          status: 'draft' | 'sent' | 'paid' | 'cancelled'
          payment_method: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'promissory_note' | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          company_id?: number | null
          invoice_type: 'sales' | 'purchase'
          invoice_number: string
          invoice_date?: string
          due_date?: string | null
          description?: string | null
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          currency?: 'TRY' | 'USD' | 'EUR' | 'GBP'
          exchange_rate?: number
          status?: 'draft' | 'sent' | 'paid' | 'cancelled'
          payment_method?: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'promissory_note' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          company_id?: number | null
          invoice_type?: 'sales' | 'purchase'
          invoice_number?: string
          invoice_date?: string
          due_date?: string | null
          description?: string | null
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          currency?: 'TRY' | 'USD' | 'EUR' | 'GBP'
          exchange_rate?: number
          status?: 'draft' | 'sent' | 'paid' | 'cancelled'
          payment_method?: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'promissory_note' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          invoice_id: number
          payment_date: string
          amount: number
          payment_method: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other'
          reference_number: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          invoice_id: number
          payment_date?: string
          amount: number
          payment_method: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other'
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          invoice_id?: number
          payment_date?: string
          amount?: number
          payment_method?: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other'
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      accounts: {
        Row: {
          id: number
          user_id: string
          code: string
          name: string
          type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
          parent_id: number | null
          description: string | null
          is_active: boolean
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          code: string
          name: string
          type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
          parent_id?: number | null
          description?: string | null
          is_active?: boolean
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          code?: string
          name?: string
          type?: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
          parent_id?: number | null
          description?: string | null
          is_active?: boolean
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      chart_of_accounts: {
        Row: {
          id: string
          user_id: string
          code: string
          name: string
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
          parent_id: string | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          name: string
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
          parent_id?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          name?: string
          account_type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
          parent_id?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          tax_number: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          email?: string | null
          phone?: string | null
          tax_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          tax_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          description: string
          amount: number
          expense_date: string
          category_id: string | null
          payment_method: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          description: string
          amount: number
          expense_date: string
          category_id?: string | null
          payment_method: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          amount?: number
          expense_date?: string
          category_id?: string | null
          payment_method?: string
          created_at?: string
          updated_at?: string
        }
      }
      expense_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }) & {
      [key: string]: GenericTable
    }
    Views: ({
      account_balances: {
        Row: {
          id: number
          user_id: string
          code: string
          name: string
          type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
          total_debit: number
          total_credit: number
          balance: number
        }
      }
    }) & {
      [key: string]: GenericView
    }
    Functions: ({
      create_default_accounts: {
        Args: { p_user_id: string }
        Returns: void
      }
      create_default_tax_rates: {
        Args: { p_user_id: string }
        Returns: void
      }
      create_default_expense_categories: {
        Args: { p_user_id: string }
        Returns: void
      }
      post_journal_entry: {
        Args: { p_journal_entry_id: number }
        Returns: boolean
      }
      get_invoice_paid_amount: {
        Args: { invoice_id_param: number }
        Returns: number
      }
      get_invoice_remaining_amount: {
        Args: { invoice_id_param: number }
        Returns: number
      }
    }) & {
      [key: string]: GenericFunction
    }
    Enums: Record<string, unknown>
    CompositeTypes: Record<string, unknown>
  }
}
