import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestUser() {
  const email = 'akhantalip@gmail.com'
  const password = 'test123456'
  const fullName = 'Test User'

  try {
    // Create user with admin API
    const { data: user, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    })

    if (signUpError) {
      console.error('Error creating user:', signUpError)
      process.exit(1)
    }

    console.log('User created successfully!')
    console.log('User ID:', user.user.id)
    console.log('Email:', email)
    console.log('Password:', password)

    // Update profile to admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'admin', full_name: fullName })
      .eq('id', user.user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    } else {
      console.log('Profile updated to admin role')
    }

    console.log('\nYou can now login with:')
    console.log('Email:', email)
    console.log('Password:', password)

  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

createTestUser()
