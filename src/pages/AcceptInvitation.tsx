import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Building2, Mail, Shield, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { OrganizationService } from '@/services/organizationService'

export default function AcceptInvitation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const token = searchParams.get('token')
  const [, setIsAccepting] = useState(false)

  // Fetch invitation details
  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      if (!token) throw new Error('Geçersiz davetiye bağlantısı')
      const inv = await OrganizationService.getInvitationByToken(token)
      if (!inv) throw new Error('Davetiye bulunamadı veya süresi dolmuş')
      return inv
    },
    enabled: !!token,
    retry: false,
  })

  // Fetch organization details
  const { data: organization } = useQuery({
    queryKey: ['organization', invitation?.organization_id],
    queryFn: async () => {
      if (!invitation) return null
      return OrganizationService.getOrganization(invitation.organization_id)
    },
    enabled: !!invitation,
  })

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Geçersiz davetiye bağlantısı')
      await OrganizationService.acceptInvitation(token)
    },
    onSuccess: () => {
      toast.success('Davetiye kabul edildi! Organizasyona hoş geldiniz.')
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    },
    onError: (error: any) => {
      console.error('Accept invitation error:', error)
      toast.error(error.message || 'Davetiye kabul edilemedi')
    },
  })

  // Decline invitation mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Geçersiz davetiye bağlantısı')
      await OrganizationService.declineInvitation(token)
    },
    onSuccess: () => {
      toast.success('Davetiye reddedildi')
      setTimeout(() => {
        navigate('/')
      }, 2000)
    },
    onError: (error: any) => {
      console.error('Decline invitation error:', error)
      toast.error(error.message || 'Davetiye reddedilemedi')
    },
  })

  const handleAccept = () => {
    if (!user) {
      // Redirect to login with return URL
      const returnUrl = window.location.href
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }
    setIsAccepting(true)
    acceptMutation.mutate()
  }

  const handleDecline = () => {
    if (confirm('Bu davetiyeyi reddetmek istediğinizden emin misiniz?')) {
      declineMutation.mutate()
    }
  }

  const roleLabels: Record<string, string> = {
    admin: 'Yönetici',
    accountant: 'Muhasebeci',
    user: 'Kullanıcı',
  }

  const roleDescriptions: Record<string, string> = {
    admin: 'Organizasyonu yönetme ve tüm işlemleri yapma yetkiniz olacak',
    accountant: 'Muhasebe işlemlerini yapma ve raporları görüntüleme yetkiniz olacak',
    user: 'Temel kullanıcı yetkileriyle çalışabileceksiniz',
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800">
        <div className="card max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Davetiye Kontrol Ediliyor
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Lütfen bekleyin...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !invitation || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Davetiye Bulunamadı
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error?.message || 'Davetiye geçersiz, süresi dolmuş veya iptal edilmiş olabilir.'}
          </p>
          <button onClick={() => navigate('/')} className="btn-secondary w-full">
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    )
  }

  // Success state (after accepting)
  if (acceptMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Davetiye Kabul Edildi!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {organization?.name} organizasyonuna hoş geldiniz. Dashboard'a yönlendiriliyorsunuz...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
        </div>
      </div>
    )
  }

  // Success state (after declining)
  if (declineMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Davetiye Reddedildi
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Davetiyeyi reddettiniz. Ana sayfaya yönlendiriliyorsunuz...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
        </div>
      </div>
    )
  }

  // Main invitation view
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="card max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Organizasyon Davetiyesi
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Bir organizasyona katılmak için davet edildiniz
          </p>
        </div>

        {/* Organization Info */}
        {organization && (
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {organization.name}
                </h2>
                {organization.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {organization.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  {organization.email && (
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      {organization.email}
                    </div>
                  )}
                  {organization.city && (
                    <div className="text-gray-600 dark:text-gray-400">
                      📍 {organization.city}, {organization.country}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invitation Details */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Davet edilen email</div>
                <div className="font-medium text-gray-900 dark:text-white">{invitation.email}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Rol</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {roleLabels[invitation.role]}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {roleDescriptions[invitation.role]}
                </div>
              </div>
            </div>
          </div>

          {invitation.invitation_message && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                Davet Mesajı
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                {invitation.invitation_message}
              </div>
            </div>
          )}
        </div>

        {/* User Status */}
        {!user && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-1">
                  Giriş Yapmanız Gerekiyor
                </div>
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  Davetiyeyi kabul etmek için önce giriş yapmanız gerekiyor. Giriş yaptıktan sonra bu
                  sayfaya geri yönlendirileceksiniz.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleDecline}
            disabled={declineMutation.isPending || acceptMutation.isPending}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {declineMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reddediliyor...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Reddet
              </>
            )}
          </button>
          <button
            onClick={handleAccept}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kabul Ediliyor...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {user ? 'Kabul Et' : 'Giriş Yap ve Kabul Et'}
              </>
            )}
          </button>
        </div>

        {/* Expiry Notice */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Bu davetiye {new Date(invitation.expires_at).toLocaleDateString('tr-TR')} tarihine kadar
          geçerlidir
        </div>
      </div>
    </div>
  )
}
