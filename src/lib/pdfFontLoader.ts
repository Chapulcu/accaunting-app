import { jsPDF } from 'jspdf'

const FONT_FAMILY = 'Roboto'

let fontsLoaded = false

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export const ensureTurkishFont = async (doc: jsPDF) => {
  if (fontsLoaded) {
    return
  }

  const baseUrl = import.meta.env.BASE_URL ?? '/'

  try {
    // Load Roboto Regular
    const regularResponse = await fetch(`${baseUrl}fonts/Roboto-Regular.ttf`)
    if (!regularResponse.ok) throw new Error('Regular font failed')
    const regularBuffer = await regularResponse.arrayBuffer()
    const regularBase64 = arrayBufferToBase64(regularBuffer)

    // Load Roboto Bold
    const boldResponse = await fetch(`${baseUrl}fonts/Roboto-Bold.ttf`)
    if (!boldResponse.ok) throw new Error('Bold font failed')
    const boldBuffer = await boldResponse.arrayBuffer()
    const boldBase64 = arrayBufferToBase64(boldBuffer)

    // Add fonts to jsPDF
    doc.addFileToVFS('Roboto-Regular.ttf', regularBase64)
    doc.addFileToVFS('Roboto-Bold.ttf', boldBase64)

    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

    fontsLoaded = true
  } catch (error) {
    console.error('Font yükleme hatası:', error)
    // Fallback to courier
    doc.setFont('courier', 'normal')
  }
}

export const setTurkishFont = (doc: jsPDF, style: 'normal' | 'bold' = 'normal') => {
  doc.setFont(FONT_FAMILY, style)
}
