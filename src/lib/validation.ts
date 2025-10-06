/**
 * Form validation utilities
 * Provides reusable validation functions with Turkish error messages
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown, fieldName: string = 'Bu alan'): ValidationResult {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return {
      isValid: false,
      error: `${fieldName} zorunludur`,
    }
  }
  return { isValid: true }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: true } // Use validateRequired for required check
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Geçerli bir e-posta adresi giriniz',
    }
  }
  return { isValid: true }
}

/**
 * Validate phone number (Turkish format)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) {
    return { isValid: true } // Use validateRequired for required check
  }

  // Remove spaces, dashes, parentheses but preserve leading + for international numbers
  const cleanPhone = phone.replace(/[\s\-()]/g, '')

  const turkishRegex = /^(?:\+90|0)?\d{10}$/
  const internationalRegex = /^\+[1-9]\d{6,14}$/ // E.164 format (7-15 digits, leading +)

  if (!turkishRegex.test(cleanPhone) && !internationalRegex.test(cleanPhone)) {
    return {
      isValid: false,
      error: 'Geçerli bir telefon numarası giriniz (örn: 0555 123 4567 veya +44 20 7123 4567)',
    }
  }
  return { isValid: true }
}

/**
 * Validate tax number (Turkish: 10 or 11 digits)
 */
export function validateTaxNumber(taxNumber: string): ValidationResult {
  if (!taxNumber) {
    return { isValid: true } // Use validateRequired for required check
  }

  const cleanTaxNumber = taxNumber.replace(/\s/g, '')

  if (!/^[0-9]{10,11}$/.test(cleanTaxNumber)) {
    return {
      isValid: false,
      error: 'Vergi numarası 10 veya 11 haneli olmalıdır',
    }
  }
  return { isValid: true }
}

/**
 * Validate number (positive, optional min/max)
 */
export function validateNumber(
  value: number | string,
  options?: {
    min?: number
    max?: number
    fieldName?: string
  }
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return {
      isValid: false,
      error: `${options?.fieldName || 'Değer'} sayısal olmalıdır`,
    }
  }

  if (options?.min !== undefined && num < options.min) {
    return {
      isValid: false,
      error: `${options?.fieldName || 'Değer'} en az ${options.min} olmalıdır`,
    }
  }

  if (options?.max !== undefined && num > options.max) {
    return {
      isValid: false,
      error: `${options?.fieldName || 'Değer'} en fazla ${options.max} olabilir`,
    }
  }

  return { isValid: true }
}

/**
 * Validate date (not in future, optional)
 */
export function validateDate(
  dateString: string,
  options?: {
    allowFuture?: boolean
    fieldName?: string
  }
): ValidationResult {
  if (!dateString) {
    return { isValid: true } // Use validateRequired for required check
  }

  const date = new Date(dateString)

  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: `${options?.fieldName || 'Tarih'} geçerli değil`,
    }
  }

  if (!options?.allowFuture && date > new Date()) {
    return {
      isValid: false,
      error: `${options?.fieldName || 'Tarih'} gelecekte olamaz`,
    }
  }

  return { isValid: true }
}

/**
 * Validate minimum length
 */
export function validateMinLength(
  value: string,
  minLength: number,
  fieldName: string = 'Bu alan'
): ValidationResult {
  if (!value) {
    return { isValid: true } // Use validateRequired for required check
  }

  if (value.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} en az ${minLength} karakter olmalıdır`,
    }
  }
  return { isValid: true }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: true } // Use validateRequired for required check
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Şifre en az 6 karakter olmalıdır',
    }
  }

  return { isValid: true }
}

/**
 * Validate IBAN (Turkish format)
 */
export function validateIBAN(iban: string): ValidationResult {
  if (!iban) {
    return { isValid: true }
  }

  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase()

  // Turkish IBAN: TR + 24 digits
  if (!/^TR[0-9]{24}$/.test(cleanIBAN)) {
    return {
      isValid: false,
      error: 'Geçerli bir IBAN numarası giriniz (TR + 24 hane)',
    }
  }

  return { isValid: true }
}

/**
 * Run multiple validations and return first error
 */
export function validateAll(...validations: ValidationResult[]): ValidationResult {
  for (const validation of validations) {
    if (!validation.isValid) {
      return validation
    }
  }
  return { isValid: true }
}
