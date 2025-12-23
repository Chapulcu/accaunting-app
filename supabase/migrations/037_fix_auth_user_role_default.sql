-- Ensure new auth users get a valid role and backfill existing rows.
ALTER TABLE auth.users
  ALTER COLUMN role SET DEFAULT 'authenticated';

UPDATE auth.users
SET role = 'authenticated'
WHERE role IS NULL OR role = '';
