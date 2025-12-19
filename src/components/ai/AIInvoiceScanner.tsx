import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'
import { Upload, ScanLine, Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface OCRResult {
  vendor_name?: string
  document_number?: string
  document_date?: string
  total_amount?: number
  currency?: string
  confidence_score: number
  items?: Array<{
    description: string
    quantity?: number
    unit_price?: number
    amount: number
  }>
}

interface AIInvoiceScannerProps {
  onScanComplete?: (result: OCRResult) => void
}

export default function AIInvoiceScanner({ onScanComplete }: AIInvoiceScannerProps) {
  const { settings } = useSettings()
  const [imageUrl, setImageUrl] = useState<string>('')
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)

  // Upload and OCR mutation
  const scanMutation = useMutation({
    mutationFn: async (file: File) => {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('invoices').getPublicUrl(fileName)

      setImageUrl(publicUrl)

      // Call OCR function
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
        'ai-ocr-processor',
        {
          body: {
            image_url: publicUrl,
            source_type: 'invoice',
          },
        }
      )

      if (ocrError) throw ocrError
      return ocrData.result
    },
    onSuccess: (result: OCRResult) => {
      setOcrResult(result)
      toast.success('Fatura başarıyla tarandı!')
      onScanComplete?.(result)
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir görsel dosyası seçin')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB\'dan küçük olmalıdır')
      return
    }

    scanMutation.mutate(file)
  }

  if (!settings?.ai_ocr_enabled) {
    return (
      <div className="card text-center">
        <ScanLine className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">
          AI OCR özelliği devre dışı. Ayarlardan etkinleştirin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Fatura Tarama (AI OCR)
        </h3>

        <label className="block">
          <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer">
            {scanMutation.isPending ? (
              <div className="space-y-3">
                <Loader2 className="w-12 h-12 animate-spin text-primary-600 dark:text-primary-400 mx-auto" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Fatura taranıyor ve AI ile analiz ediliyor...
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Fatura görselini yükleyin
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    PNG, JPG veya PDF (maks 10MB)
                  </p>
                </div>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={scanMutation.isPending}
            className="sr-only"
          />
        </label>
      </div>

      {/* OCR Result */}
      {ocrResult && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              Tarama Sonucu
            </h3>
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              Güven: {ocrResult.confidence_score}%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {ocrResult.vendor_name && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Satıcı
                </label>
                <p className="text-gray-900 dark:text-white mt-1">{ocrResult.vendor_name}</p>
              </div>
            )}
            {ocrResult.document_number && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fatura No
                </label>
                <p className="text-gray-900 dark:text-white mt-1">{ocrResult.document_number}</p>
              </div>
            )}
            {ocrResult.document_date && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tarih
                </label>
                <p className="text-gray-900 dark:text-white mt-1">{ocrResult.document_date}</p>
              </div>
            )}
            {ocrResult.total_amount && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tutar
                </label>
                <p className="text-gray-900 dark:text-white mt-1">
                  {ocrResult.total_amount} {ocrResult.currency || 'TRY'}
                </p>
              </div>
            )}
          </div>

          {ocrResult.items && ocrResult.items.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kalemler
              </h4>
              <div className="space-y-2">
                {ocrResult.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700 rounded"
                  >
                    <span className="text-sm text-gray-900 dark:text-white">
                      {item.description}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.amount} {ocrResult.currency || 'TRY'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {imageUrl && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <img
                src={imageUrl}
                alt="Scanned invoice"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
