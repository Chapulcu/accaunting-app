-- Kullanıcıyı admin yapmak için
-- Email adresinizi aşağıdaki sorguya yazın

UPDATE profiles
SET role = 'admin'
WHERE email = 'YOUR_EMAIL_HERE@example.com';

-- Veya tüm kullanıcıları görmek için:
-- SELECT id, email, full_name, role FROM profiles;

-- Ardından ID ile güncellemek için:
-- UPDATE profiles SET role = 'admin' WHERE id = 'USER_ID_HERE';
