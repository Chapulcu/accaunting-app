#!/usr/bin/env node

/**
 * Admin kullanıcısı oluşturma scripti
 *
 * Kullanım:
 *   node scripts/create-admin.js
 *
 * Bu script local Supabase instance'ında admin kullanıcısı oluşturur.
 * Production için Supabase Dashboard kullanılmalıdır.
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdminUser() {
  console.log('🔐 Admin Kullanıcı Oluşturma Scripti\n');

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
    // Kullanıcı bilgilerini al
    const email = await question('Email (örn: admin@accounting.com): ');
    const password = await question('Şifre (min 6 karakter): ');
    const fullName = await question('Ad Soyad (örn: Admin User): ') || 'Admin User';

    if (!email || !password || password.length < 6) {
      console.error('❌ Hata: Geçerli email ve şifre (min 6 karakter) giriniz.');
      process.exit(1);
    }

    console.log('\n⏳ Kullanıcı oluşturuluyor...');

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
      console.error('❌ Kullanıcı oluşturma hatası:', authError.message);
      process.exit(1);
    }

    console.log('✅ Auth kullanıcısı oluşturuldu:', authData.user.id);

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
  } finally {
    rl.close();
  }
}

createAdminUser();
