/**
 * Currency formatting utilities
 * Centralizes currency formatting for consistent display across the app
 */

export type Currency = 'TRY' | 'USD' | 'EUR'

export const currencySymbols: Record<Currency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
}

/**
 * Format amount with currency symbol
 * @param amount - The amount to format
 * @param currency - The currency code (defaults to TRY)
 * @param locale - The locale for formatting (defaults to tr-TR)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'TRY',
  locale: string = 'tr-TR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

/**
 * Get currency symbol
 * @param currency - The currency code (defaults to TRY)
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: Currency = 'TRY'): string {
  return currencySymbols[currency]
}

/**
 * Format amount with custom decimal places
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (defaults to 2)
 * @param locale - The locale for formatting (defaults to tr-TR)
 * @returns Formatted number string
 */
export function formatAmount(
  amount: number,
  decimals: number = 2,
  locale: string = 'tr-TR'
): string {
  return amount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
