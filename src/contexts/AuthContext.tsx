import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Check if email is confirmed
      if (data.user && !data.user.email_confirmed_at) {
        toast.error('Lütfen e-posta adresinizi doğrulayın')
        throw new Error('Email not confirmed')
      }

      toast.success('Başarıyla giriş yapıldı!')
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      const errorMessage = message === 'Invalid login credentials'
        ? 'E-posta veya şifre hatalı'
        : message || 'Giriş yapılamadı'
      toast.error(errorMessage)
      throw error instanceof Error ? error : new Error(errorMessage)
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) throw error

      // Check if email confirmation is required
      if (data.user && !data.session) {
        toast.success('Kayıt başarılı! E-posta adresinizi kontrol edin ve doğrulama linkine tıklayın.', {
          duration: 5000,
        })
        return
      }

      // Profile is automatically created by database trigger (handle_new_user)
      toast.success('Kayıt başarılı! Giriş yapabilirsiniz.')
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error) || 'Kayıt olunamadı'
      toast.error(errorMessage)
      throw error instanceof Error ? error : new Error(errorMessage)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success('Çıkış yapıldı')
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error) || 'Çıkış yapılamadı'
      toast.error(errorMessage)
      throw error instanceof Error ? error : new Error(errorMessage)
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
