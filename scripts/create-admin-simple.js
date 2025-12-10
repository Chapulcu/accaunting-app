#!/usr/bin/env node

/**
 * Admin kullanıcısı oluşturma scripti (basit versiyon)
 *
 * Kullanım:
 *   node scripts/create-admin-simple.js [email] [password]
 *
 * Örnek:
 *   node scripts/create-admin-simple.js admin@accounting.com Admin123!
 *
 * Parametresiz çalıştırılırsa default değerler kullanılır:
 *   Email: admin@accounting.com
 *   Şifre: Admin123!
 */

import { createClient } from '@supabase/supabase-js';

async function createAdminUser() {
  // Command line arguments
  const email = process.argv[2] || 'admin@accounting.com';
  const password = process.argv[3] || 'Admin123!';
  const fullName = 'Admin User';

  console.log('🔐 Admin Kullanıcı Oluşturma Scripti\n');
  console.log(`Email: ${email}`);
  console.log(`Şifre: ${'*'.repeat(password.length)}\n`);

  // Supabase client oluştur (service role key ile)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('⏳ Kullanıcı oluşturuluyor...');

    // Admin kullanıcısı oluştur
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  Bu email zaten kayıtlı. Mevcut kullanıcıyı admin yapıyorum...');

        // Mevcut kullanıcının ID'sini bul
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === email);

        if (existingUser) {
          // Profile'ı admin yap
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              role: 'admin',
              full_name: fullName,
              company_name: 'Admin Company'
            })
            .eq('email', email);

          if (profileError) {
            console.error('❌ Profile güncelleme hatası:', profileError.message);
            process.exit(1);
          }

          console.log('✅ Mevcut kullanıcı admin yapıldı');
          console.log('\nGiriş bilgileri:');
          console.log(`Email: ${email}`);
          console.log('Şifre: Mevcut şifrenizi kullanın veya "Şifremi Unuttum" ile sıfırlayın\n');
          process.exit(0);
        }
      }

      console.error('❌ Kullanıcı oluşturma hatası:', authError.message);
      process.exit(1);
    }

    console.log('✅ Auth kullanıcısı oluşturuldu:', authData.user.id);

    // Kısa bir bekleme (profile trigger'ın çalışması için)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Profile'ı admin yap
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        full_name: fullName,
        company_name: 'Admin Company'
      })
      .eq('email', email);

    if (profileError) {
      console.error('⚠️  Profile güncelleme hatası:', profileError.message);
      console.log('Profile\'ı manuel olarak admin yapmanız gerekebilir.');
      console.log('\nSQL komutu:');
      console.log(`UPDATE profiles SET role = 'admin' WHERE email = '${email}';`);
    } else {
      console.log('✅ Profile admin rolü atandı');
    }

    console.log('\n🎉 Admin kullanıcısı başarıyla oluşturuldu!');
    console.log('\nGiriş bilgileri:');
    console.log(`Email: ${email}`);
    console.log(`Şifre: ${password}`);
    console.log('\n⚠️  Bu bilgileri güvenli bir yerde saklayın!\n');

  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error.message);
    process.exit(1);
  }
}

createAdminUser();
