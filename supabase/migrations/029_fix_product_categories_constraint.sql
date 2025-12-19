-- Fix product_categories missing unique constraint
-- This was causing errors when creating new users

-- Add unique constraint on (user_id, name)
ALTER TABLE product_categories
ADD CONSTRAINT product_categories_user_id_name_key
UNIQUE (user_id, name);

-- Log for notification
DO $$
BEGIN
    RAISE NOTICE 'Product categories unique constraint added';
END $$;
