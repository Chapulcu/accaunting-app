import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Bell, Plus, X, Trash2, CheckCircle, Calendar, Clock } from 'lucide-react'
import Tooltip from '@/components/Tooltip'

type ReminderType = 'invoice_due' | 'payment_due' | 'approval_pending' | 'custom'

interface Reminder {
  id: string
  title: string
  message: string | null
  reminder_type: ReminderType
  remind_at: string
  reminded: boolean
  reminded_at: string | null
  recurring: boolean
  recurrence_rule: string | null
  is_active: boolean
  created_at: string
}

export default function Reminders() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    reminder_type: 'custom' as ReminderType,
    remind_at: '',
    recurring: false,
    recurrence_rule: '',
  })

  // Fetch reminders
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('remind_at', { ascending: true })

      if (error) throw error
      return data as Reminder[]
    },
    enabled: !!user,
  })

  // Create reminder mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase.from('reminders').insert({
        user_id: user.id,
        ...formData,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Hatırlatma oluşturuldu')
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Hatırlatma oluşturulamadı')
    },
  })

  // Delete reminder mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('reminders')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Hatırlatma silindi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Silme başarısız')
    },
  })

  // Mark as reminded
  const markRemindedMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('reminders')
        .update({ reminded: true, reminded_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Hatırlatma tamamlandı olarak işaretlendi')
    },
  })

  const handleOpenModal = () => {
    setFormData({
      title: '',
      message: '',
      reminder_type: 'custom',
      remind_at: '',
      recurring: false,
      recurrence_rule: '',
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
  }

  const typeLabels: Record<ReminderType, string> = {
    invoice_due: 'Fatura Vadesi',
    payment_due: 'Ödeme Vadesi',
    approval_pending: 'Onay Bekliyor',
    custom: 'Özel',
  }

  const typeColors: Record<ReminderType, string> = {
    invoice_due: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    payment_due: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    approval_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }

  const upcomingReminders = reminders?.filter((r) => !r.reminded && new Date(r.remind_at) > new Date())
  const pastDueReminders = reminders?.filter((r) => !r.reminded && new Date(r.remind_at) <= new Date())
  const completedReminders = reminders?.filter((r) => r.reminded)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hatırlatmalar</h1>
            <Tooltip content="Önemli tarihleri ve görevleri hatırlatın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Otomatik bildirimler ve hatırlatmalar
          </p>
        </div>
        <button onClick={handleOpenModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Yeni Hatırlatma
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Yaklaşan</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {upcomingReminders?.length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Gecikmiş</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {pastDueReminders?.length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Tamamlanan</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {completedReminders?.length || 0}
          </p>
        </div>
      </div>

      {/* Past Due Reminders */}
      {pastDueReminders && pastDueReminders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Gecikmiş Hatırlatmalar
          </h2>
          <div className="space-y-3">
            {pastDueReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="card border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">{reminder.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${typeColors[reminder.reminder_type]}`}>
                        {typeLabels[reminder.reminder_type]}
                      </span>
                    </div>
                    {reminder.message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {reminder.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {new Date(reminder.remind_at).toLocaleString('tr-TR')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markRemindedMutation.mutate(reminder.id)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                      title="Tamamlandı"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(reminder.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Reminders */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : upcomingReminders && upcomingReminders.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Yaklaşan Hatırlatmalar
          </h2>
          <div className="space-y-3">
            {upcomingReminders.map((reminder) => (
              <div key={reminder.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">{reminder.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${typeColors[reminder.reminder_type]}`}>
                        {typeLabels[reminder.reminder_type]}
                      </span>
                      {reminder.recurring && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded text-xs">
                          Tekrarlı
                        </span>
                      )}
                    </div>
                    {reminder.message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {reminder.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {new Date(reminder.remind_at).toLocaleString('tr-TR')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markRemindedMutation.mutate(reminder.id)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                      title="Tamamlandı"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(reminder.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Henüz hatırlatma eklenmemiş</p>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Yeni Hatırlatma
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate()
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Başlık *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                  placeholder="Hatırlatma başlığı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mesaj
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Ek bilgi..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tür *
                  </label>
                  <select
                    value={formData.reminder_type}
                    onChange={(e) =>
                      setFormData({ ...formData, reminder_type: e.target.value as ReminderType })
                    }
                    className="input-field"
                  >
                    <option value="custom">Özel</option>
                    <option value="invoice_due">Fatura Vadesi</option>
                    <option value="payment_due">Ödeme Vadesi</option>
                    <option value="approval_pending">Onay Bekliyor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hatırlatma Zamanı *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.remind_at}
                    onChange={(e) => setFormData({ ...formData, remind_at: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Tekrarlı Hatırlatma</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Belirli aralıklarla tekrarla
                  </p>
                </div>
              </label>

              {formData.recurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tekrarlama Sıklığı
                  </label>
                  <select
                    value={formData.recurrence_rule}
                    onChange={(e) => setFormData({ ...formData, recurrence_rule: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Seçiniz</option>
                    <option value="DAILY">Günlük</option>
                    <option value="WEEKLY">Haftalık</option>
                    <option value="MONTHLY">Aylık</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
