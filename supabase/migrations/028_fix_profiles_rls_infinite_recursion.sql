-- Fix infinite recursion in profiles RLS policies
-- The "Admins can view all profiles" policy was causing infinite recursion
-- because it queries the profiles table within a profiles table policy

-- Drop the problematic admin view policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Keep the basic user policies
-- Users can view their own profile
-- (This policy already exists: "Users can view own profile")

-- Users can update their own profile
-- (This policy already exists: "Users can update own profile")

-- For admin to view all profiles, we'll use a database function with SECURITY DEFINER
-- This bypasses RLS and prevents infinite recursion

CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Get the current user's role
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Only admins can get all profiles
  IF current_user_role = 'admin' THEN
    RETURN QUERY SELECT * FROM profiles;
  ELSE
    -- Non-admins can only see their own profile
    RETURN QUERY SELECT * FROM profiles WHERE id = auth.uid();
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_profiles() TO authenticated;

-- Log for notification
DO $$
BEGIN
    RAISE NOTICE 'Profiles RLS infinite recursion fixed - admin policy removed, function created';
END $$;
