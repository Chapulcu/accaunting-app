import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestAdmin() {
  const email = 'akhantalip@gmail.com'
  const password = 'test123456'
  const fullName = 'Admin User'

  try {
    console.log('Creating admin user...')

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
      console.error('Error creating user:', signUpError.message)
      process.exit(1)
    }

    console.log('✓ User created:', user.user.id)
    console.log('✓ Email:', email)

    // Wait a bit for triggers to complete
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check if profile was created
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError.message)
    } else {
      console.log('✓ Profile created:', profile.email)
    }

    // Update profile to admin role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.user.id)

    if (updateError) {
      console.error('Error updating role:', updateError.message)
    } else {
      console.log('✓ Role updated to admin')
    }

    // Check if organization was created
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('user_id', user.user.id)
      .single()

    if (membershipError) {
      console.error('Error fetching organization:', membershipError.message)
    } else {
      console.log('✓ Organization created:', membership.organizations.name)
      console.log('✓ Membership role:', membership.role)
    }

    console.log('\n=================================')
    console.log('TEST ADMIN CREATED SUCCESSFULLY!')
    console.log('=================================')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('=================================\n')

  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

createTestAdmin()
