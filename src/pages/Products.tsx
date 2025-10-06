import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  X,
  Download,
  Barcode,
} from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'
import Tooltip from '@/components/Tooltip'

interface Product {
  id: number
  code: string
  name: string
  description?: string
  product_type: 'product' | 'service'
  unit: string
  purchase_price: number
  sale_price: number
  tax_rate: number
  track_inventory: boolean
  current_stock: number
  minimum_stock: number
  maximum_stock?: number
  barcode?: string
  sku?: string
  is_active: boolean
  category_id?: number
  product_categories?: {
    name: string
  }
}

interface ProductCategory {
  id: number
  name: string
}

export default function Products() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'product' | 'service'>('all')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    product_type: 'product' as 'product' | 'service',
    unit: 'adet',
    purchase_price: 0,
    sale_price: 0,
    tax_rate: 20,
    track_inventory: true,
    current_stock: 0,
    minimum_stock: 0,
    maximum_stock: 0,
    barcode: '',
    sku: '',
    category_id: null as number | null,
  })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', searchTerm, filterType, filterStock],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, product_categories(name)')
        .order('created_at', { ascending: false })

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`)
      }

      if (filterType !== 'all') {
        query = query.eq('product_type', filterType)
      }

      const { data, error } = await query
      if (error) throw error

      let filteredData = data as Product[]

      if (filterStock === 'low') {
        filteredData = filteredData.filter(p => p.track_inventory && p.current_stock <= p.minimum_stock && p.current_stock > 0)
      } else if (filterStock === 'out') {
        filteredData = filteredData.filter(p => p.track_inventory && p.current_stock === 0)
      }

      return filteredData
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data as ProductCategory[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('Kullanıcı bulunamadı')

      const payload = {
        ...data,
        user_id: user.id,
        maximum_stock: data.maximum_stock || null,
        category_id: data.category_id || null,
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editingProduct ? 'Ürün güncellendi' : 'Ürün oluşturuldu')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      handleCloseModal()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Bir hata oluştu')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Ürün silindi')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Silme işlemi başarısız')
    },
  })

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        code: product.code,
        name: product.name,
        description: product.description || '',
        product_type: product.product_type,
        unit: product.unit,
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        tax_rate: product.tax_rate,
        track_inventory: product.track_inventory,
        current_stock: product.current_stock,
        minimum_stock: product.minimum_stock,
        maximum_stock: product.maximum_stock || 0,
        barcode: product.barcode || '',
        sku: product.sku || '',
        category_id: product.category_id || null,
      })
    } else {
      setEditingProduct(null)
      setFormData({
        code: `PRD-${Date.now()}`,
        name: '',
        description: '',
        product_type: 'product',
        unit: 'adet',
        purchase_price: 0,
        sale_price: 0,
        tax_rate: 20,
        track_inventory: true,
        current_stock: 0,
        minimum_stock: 0,
        maximum_stock: 0,
        barcode: '',
        sku: '',
        category_id: null,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingProduct(null)
  }

  const handleSave = () => {
    if (!formData.name || !formData.code) {
      toast.error('Ürün adı ve kodu zorunludur')
      return
    }
    saveMutation.mutate(formData)
  }

  const handleDelete = (id: number) => {
    if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleExportExcel = () => {
    if (!products || products.length === 0) {
      toast.error('Dışa aktarılacak ürün bulunamadı')
      return
    }

    const data = products.map(p => ({
      'Kod': p.code,
      'Ürün Adı': p.name,
      'Tip': p.product_type === 'product' ? 'Ürün' : 'Hizmet',
      'Kategori': p.product_categories?.name || '-',
      'Birim': p.unit,
      'Alış Fiyatı': p.purchase_price,
      'Satış Fiyatı': p.sale_price,
      'Mevcut Stok': p.current_stock,
      'Min. Stok': p.minimum_stock,
      'Barkod': p.barcode || '-',
    }))

    exportToExcel(data, `Urunler_${new Date().toISOString().split('T')[0]}`, 'Ürünler')
    toast.success('Ürünler Excel olarak dışa aktarıldı')
  }

  const lowStockCount = products?.filter(p => p.track_inventory && p.current_stock <= p.minimum_stock && p.current_stock > 0).length || 0
  const outOfStockCount = products?.filter(p => p.track_inventory && p.current_stock === 0).length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Ürün & Stok Yönetimi
            </h1>
            <Tooltip content="Ürün bilgilerini, fiyatları, stok miktarlarını yönetin. SKU/barkod tanımlayın, kategorilere ayırın. Minimum stok seviyesi uyarıları alın. Excel'e aktarın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Ürünlerinizi ve stoklarınızı yönetin
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="btn-secondary">
            <Download className="w-5 h-5 mr-2" />
            Excel
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Yeni Ürün
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
              <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Ürün</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {products?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ürün</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {products?.filter(p => p.product_type === 'product').length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Düşük Stok</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {lowStockCount}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Stok Yok</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {outOfStockCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Ürün ara (ad, kod, barkod)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="input-field"
          >
            <option value="all">Tüm Tipler</option>
            <option value="product">Ürün</option>
            <option value="service">Hizmet</option>
          </select>

          <select
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value as any)}
            className="input-field"
          >
            <option value="all">Tüm Stoklar</option>
            <option value="low">Düşük Stok</option>
            <option value="out">Stok Yok</option>
          </select>
        </div>
      </div>

      {/* Products List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Kod
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Ürün Adı
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tip
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Kategori
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Alış
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Satış
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Stok
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {products?.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {product.barcode && (
                          <Barcode className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {product.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                      {product.name}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        product.product_type === 'product'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {product.product_type === 'product' ? 'Ürün' : 'Hizmet'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                      {product.product_categories?.name || '-'}
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900 dark:text-white">
                      ₺{product.purchase_price.toLocaleString('tr-TR')}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      ₺{product.sale_price.toLocaleString('tr-TR')}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {product.track_inventory ? (
                        <span className={`font-semibold ${
                          product.current_stock === 0
                            ? 'text-red-600 dark:text-red-400'
                            : product.current_stock <= product.minimum_stock
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {product.current_stock} {product.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="Düzenle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {products?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  Henüz ürün bulunmuyor
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ürün Tipi *
                  </label>
                  <select
                    value={formData.product_type}
                    onChange={(e) => setFormData({ ...formData, product_type: e.target.value as 'product' | 'service' })}
                    className="input-field"
                  >
                    <option value="product">Ürün</option>
                    <option value="service">Hizmet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ürün Kodu *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ürün Adı *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategori
                  </label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : null })}
                    className="input-field"
                  >
                    <option value="">Kategori Seçiniz</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Birim
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alış Fiyatı (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Satış Fiyatı (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    KDV Oranı (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Barkod
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="input-field"
                  />
                </div>

                {formData.product_type === 'product' && (
                  <>
                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.track_inventory}
                          onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Stok takibi yap
                        </span>
                      </label>
                    </div>

                    {formData.track_inventory && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Mevcut Stok
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={formData.current_stock}
                            onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                            className="input-field"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Minimum Stok
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={formData.minimum_stock}
                            onChange={(e) => setFormData({ ...formData, minimum_stock: parseFloat(e.target.value) || 0 })}
                            className="input-field"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 p-6">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloseModal}
                  className="btn-secondary"
                  disabled={saveMutation.isPending}
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
