import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Trash2,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

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

interface FileWithResult {
  file: File
  status: 'pending' | 'processing' | 'success' | 'error'
  result?: OCRResult
  error?: string
  preview?: string
}

interface BulkOCRProcessorProps {
  onClose: () => void
  onBulkComplete?: (results: Array<{ file: File; result: OCRResult }>) => void
  entityType?: 'invoice' | 'expense'
}

export default function BulkOCRProcessor({
  onClose,
  onBulkComplete,
  entityType = 'invoice'
}: BulkOCRProcessorProps) {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileWithResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Handle file selection
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles: FileWithResult[] = Array.from(selectedFiles).map(file => {
      // Create preview URL for images
      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined

      return {
        file,
        status: 'pending' as const,
        preview
      }
    })

    setFiles(prev => [...prev, ...newFiles])
  }, [])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    handleFileSelect(droppedFiles)
  }, [handleFileSelect])

  // Remove file from list
  const handleRemoveFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      // Revoke preview URL
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  // Process single file through OCR
  const processFile = async (file: File): Promise<OCRResult> => {
    if (!user) throw new Error('User not authenticated')

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('ocr-uploads')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('ocr-uploads')
      .getPublicUrl(fileName)

    // Call OCR Edge Function
    const { data, error } = await supabase.functions.invoke('ai-ocr-processor', {
      body: {
        image_url: publicUrl,
        entity_type: entityType,
      },
    })

    // Clean up storage
    await supabase.storage.from('ocr-uploads').remove([fileName])

    if (error) throw error
    if (!data || !data.success) {
      throw new Error(data?.error || 'OCR processing failed')
    }

    return data.data
  }

  // Process all files sequentially
  const handleProcessAll = async () => {
    if (files.length === 0) {
      toast.error('Lütfen en az bir dosya yükleyin')
      return
    }

    setIsProcessing(true)
    const updatedFiles: FileWithResult[] = [...files]

    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status !== 'pending') continue

      // Update status to processing
      updatedFiles[i].status = 'processing'
      setFiles([...updatedFiles])

      try {
        const result = await processFile(updatedFiles[i].file)
        updatedFiles[i].status = 'success'
        updatedFiles[i].result = result
        toast.success(`${updatedFiles[i].file.name} işlendi`)
      } catch (error) {
        updatedFiles[i].status = 'error'
        updatedFiles[i].error = error instanceof Error ? error.message : 'İşlenirken hata oluştu'
        toast.error(`${updatedFiles[i].file.name} hatalı`)
      }

      setFiles([...updatedFiles])
    }

    setIsProcessing(false)
    toast.success('Tüm dosyalar işlendi!')
  }

  // Export successful results
  const handleExportResults = () => {
    const successfulResults = files
      .filter(f => f.status === 'success' && f.result)
      .map(f => ({ file: f.file, result: f.result! }))

    if (successfulResults.length === 0) {
      toast.error('Başarılı sonuç bulunamadı')
      return
    }

    onBulkComplete?.(successfulResults)
    onClose()
  }

  // Retry failed files
  const handleRetryFailed = async () => {
    const failedIndices = files
      .map((f, i) => f.status === 'error' ? i : -1)
      .filter(i => i !== -1)

    if (failedIndices.length === 0) {
      toast.error('Tekrar denenecek hatalı dosya yok')
      return
    }

    setIsProcessing(true)
    const updatedFiles = [...files]

    for (const i of failedIndices) {
      updatedFiles[i].status = 'processing'
      updatedFiles[i].error = undefined
      setFiles([...updatedFiles])

      try {
        const result = await processFile(updatedFiles[i].file)
        updatedFiles[i].status = 'success'
        updatedFiles[i].result = result
        toast.success(`${updatedFiles[i].file.name} tekrar işlendi`)
      } catch (error) {
        updatedFiles[i].status = 'error'
        updatedFiles[i].error = error instanceof Error ? error.message : 'İşlenirken hata oluştu'
      }

      setFiles([...updatedFiles])
    }

    setIsProcessing(false)
  }

  const successCount = files.filter(f => f.status === 'success').length
  const errorCount = files.filter(f => f.status === 'error').length
  const pendingCount = files.filter(f => f.status === 'pending').length
  const processingCount = files.filter(f => f.status === 'processing').length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Toplu OCR Tarama
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Birden fazla {entityType === 'invoice' ? 'fatura' : 'fiş'} yükleyip otomatik işleyin
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            disabled={isProcessing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Upload Area */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Dosyaları sürükleyip bırakın veya tıklayarak seçin
            </p>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="bulk-file-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="bulk-file-upload"
              className="btn-primary inline-block cursor-pointer"
            >
              Dosya Seç
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              JPG, PNG, PDF formatları desteklenir
            </p>
          </div>
        </div>

        {/* Stats */}
        {files.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{files.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Toplam</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingCount + processingCount}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Bekliyor</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{successCount}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Başarılı</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Hatalı</p>
              </div>
            </div>
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-6">
          {files.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Henüz dosya yüklenmedi
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((fileItem, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  {/* Preview */}
                  {fileItem.preview && (
                    <img
                      src={fileItem.preview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  {!fileItem.preview && (
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                  )}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(fileItem.file.size / 1024).toFixed(1)} KB
                    </p>
                    {fileItem.result && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {fileItem.result.vendor_name} • ₺{fileItem.result.total_amount?.toLocaleString('tr-TR')}
                      </p>
                    )}
                    {fileItem.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {fileItem.error}
                      </p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div>
                    {fileItem.status === 'pending' && (
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    {fileItem.status === 'processing' && (
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    )}
                    {fileItem.status === 'success' && (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    )}
                    {fileItem.status === 'error' && (
                      <XCircle className="w-8 h-8 text-red-500" />
                    )}
                  </div>

                  {/* Remove Button */}
                  {!isProcessing && fileItem.status !== 'processing' && (
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {errorCount > 0 && (
                <button
                  onClick={handleRetryFailed}
                  disabled={isProcessing}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Loader2 className="w-4 h-4" />
                  Hatalı Olanları Tekrarla
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="btn-secondary"
              >
                İptal
              </button>

              {files.length > 0 && pendingCount > 0 && (
                <button
                  onClick={handleProcessAll}
                  disabled={isProcessing}
                  className="btn-primary flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      İşleniyor...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Tümünü İşle ({pendingCount})
                    </>
                  )}
                </button>
              )}

              {successCount > 0 && pendingCount === 0 && processingCount === 0 && (
                <button
                  onClick={handleExportResults}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Sonuçları Kullan ({successCount})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
