export const getErrorMessage = (error: unknown, fallback = 'Bir hata oluştu'): string => {
  if (error instanceof Error) {
    return error.message || fallback
  }

  if (typeof error === 'string') {
    return error || fallback
  }

  return fallback
}
