import { useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Wallet,
  Mail,
  Calendar,
  Package,
  TrendingUp,
  BookMarked,
  Lock,
  FileCheck,
  FileArchive,
  Shield,
  Bell,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building2,
} from 'lucide-react'

type UserRole = 'user' | 'accountant' | 'manager' | 'admin'

type MenuItem = {
  path: string
  icon: ElementType
  label: string
  allowedRoles?: UserRole[]
}

type MenuGroup = {
  title: string
  icon: ElementType
  items: MenuItem[]
  allowedRoles?: UserRole[]
}

const menuGroups: MenuGroup[] = [
  {
    title: 'Genel',
    icon: LayoutDashboard,
    items: [{ path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
    // Herkes görebilir
  },
  {
    title: 'Satış & Müşteri',
    icon: Users,
    items: [
      { path: '/customers', icon: Users, label: 'Müşteriler' },
      { path: '/invoices', icon: FileText, label: 'Faturalar' },
      { path: '/recurring-invoices', icon: Calendar, label: 'Tekrarlayan Faturalar', allowedRoles: ['accountant', 'manager', 'admin'] },
      { path: '/payments', icon: Wallet, label: 'Ödemeler' },
      { path: '/products', icon: Package, label: 'Ürünler & Stok' },
    ],
    // Herkes görebilir
  },
  {
    title: 'Finans & Nakit',
    icon: Wallet,
    items: [
      { path: '/expenses', icon: Receipt, label: 'Giderler' },
      { path: '/bank-accounts', icon: Building2, label: 'Banka Hesapları', allowedRoles: ['accountant', 'manager', 'admin'] },
      { path: '/exchange-rates', icon: TrendingUp, label: 'Döviz Kurları', allowedRoles: ['accountant', 'manager', 'admin'] },
    ],
    // Herkes görebilir
  },
  {
    title: 'Muhasebe',
    icon: BookOpen,
    items: [
      { path: '/accounts', icon: BookOpen, label: 'Hesap Planı' },
      { path: '/journal-entries', icon: BookMarked, label: 'Yevmiye Defteri', allowedRoles: ['accountant', 'manager', 'admin'] },
      { path: '/period-close', icon: Lock, label: 'Dönem Kapama', allowedRoles: ['accountant', 'manager', 'admin'] },
    ],
    allowedRoles: ['accountant', 'manager', 'admin'],
  },
  {
    title: 'Raporlar & Analiz',
    icon: BarChart3,
    items: [
      { path: '/reports', icon: BarChart3, label: 'Raporlar' },
      { path: '/email-history', icon: Mail, label: 'Email Geçmişi', allowedRoles: ['manager', 'admin'] },
    ],
    // Herkes raporları görebilir
  },
  {
    title: 'E-Dönüşüm',
    icon: FileCheck,
    items: [
      { path: '/e-invoices', icon: FileCheck, label: 'E-Fatura Yönetimi' },
      { path: '/e-invoice-settings', icon: Settings, label: 'E-Fatura Ayarları', allowedRoles: ['manager', 'admin'] },
      { path: '/e-archive-settings', icon: FileArchive, label: 'E-Arşiv Ayarları', allowedRoles: ['manager', 'admin'] },
    ],
    allowedRoles: ['accountant', 'manager', 'admin'],
  },
  {
    title: 'Otomasyon',
    icon: Bell,
    items: [
      { path: '/reminders', icon: Bell, label: 'Hatırlatmalar', allowedRoles: ['manager', 'admin'] },
      { path: '/approval-workflows', icon: GitBranch, label: 'Onay Akışları', allowedRoles: ['manager', 'admin'] },
    ],
    allowedRoles: ['manager', 'admin'],
  },
  {
    title: 'Yetki & Ayarlar',
    icon: Shield,
    items: [
      { path: '/users-management', icon: Users, label: 'Kullanıcılar', allowedRoles: ['admin'] },
      { path: '/roles-permissions', icon: Shield, label: 'Roller & İzinler', allowedRoles: ['admin'] },
      { path: '/settings', icon: Settings, label: 'Ayarlar' },
    ],
    // Herkes ayarlarını görebilir ama roller ve kullanıcılar sadece admin
  },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    menuGroups.reduce((acc, group, index) => {
      acc[group.title] = index === 0
      return acc
    }, {} as Record<string, boolean>)
  )
  const location = useLocation()
  const { user, userRole, profileLoading, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev)
  }

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  const renderedGroups = useMemo(() => {
    if (!userRole) return []

    return menuGroups
      .filter((group) => {
        // Eğer grup allowedRoles tanımlı ise, kullanıcı rolü kontrol et
        if (group.allowedRoles && !group.allowedRoles.includes(userRole)) {
          return false
        }
        return true
      })
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          // Eğer item allowedRoles tanımlı ise, kullanıcı rolü kontrol et
          if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
            return false
          }
          return true
        }),
      }))
      .filter((group) => group.items.length > 0) // Boş grupları kaldır
  }, [userRole])

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${isCollapsed ? 'w-20 lg:w-20' : 'w-64 lg:w-64'}
          glass-strong transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-6 border-b border-gray-200 dark:border-slate-700`}>
            <div className="flex items-center gap-2">
              <h1 className={`text-xl font-bold text-primary-500 transition-opacity ${isCollapsed ? 'opacity-0 pointer-events-none hidden' : 'opacity-100'}`}>
                Muhasebe App
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 hover:text-primary-500 hover:border-primary-500 transition-colors"
                aria-label={isCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 p-4 space-y-2 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'}`}>
            {profileLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              renderedGroups.map((group) => {
              const GroupIcon = group.icon || Layers
              const isOpen = openGroups[group.title]

              return (
                <div key={group.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className={`
                      w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'justify-between px-4'}
                      ${isCollapsed ? 'py-3' : 'py-2.5'} rounded-lg text-sm font-semibold transition-colors
                      ${
                        isOpen
                          ? 'bg-gray-100 dark:bg-slate-800 text-primary-600 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }
                    `}
                    aria-expanded={isOpen}
                    aria-controls={`group-${group.title}`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3'}`}>
                      <GroupIcon className="w-5 h-5" />
                      {!isCollapsed && <span className="tracking-wide uppercase text-xs">{group.title}</span>}
                    </div>
                    {!isCollapsed && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                      />
                    )}
                  </button>

                  <div
                    id={`group-${group.title}`}
                    className={`
                      space-y-1 overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out
                      ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
                    `}
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = location.pathname === item.path

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`
                            flex items-center ${isCollapsed ? 'justify-center gap-0 px-3 py-3' : 'gap-3 px-4 py-2.5'}
                            rounded-lg transition-all text-sm
                            ${
                              isActive
                                ? 'bg-primary-500 text-white shadow-md'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }
                          `}
                        >
                          <Icon className="w-5 h-5" />
                          <span
                            className={`font-medium transition-all duration-200 ${
                              isCollapsed ? 'opacity-0 max-w-0 overflow-hidden lg:hidden' : 'opacity-100 ml-3'
                            }`}
                          >
                            {item.label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })
            )}
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center ${isCollapsed ? 'justify-center gap-0 px-3' : 'justify-between gap-3 px-4'} w-full py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors`}
              >
                <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                {!isCollapsed && (
                  <>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user?.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {userRole === 'admin' ? 'Yönetici' :
                         userRole === 'manager' ? 'Müdür' :
                         userRole === 'accountant' ? 'Muhasebeci' : 'Kullanıcı'}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </>
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 glass-strong rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Çıkış Yap</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden glass-strong border-b border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-primary-500">
              Muhasebe App
            </h1>
            <div className="w-6"></div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}
    </div>
  )
}
