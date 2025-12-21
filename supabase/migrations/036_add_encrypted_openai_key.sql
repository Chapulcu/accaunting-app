-- Migration 036: Add Encrypted OpenAI API Key Storage
--
-- Purpose: Add secure storage for OpenAI API key
-- This enables AI features (OCR, Chatbot, Categorization, Predictions) to function

-- Add encrypted_openai_api_key column to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS encrypted_openai_api_key TEXT;

-- Update RLS policies (app_settings should already have RLS enabled from previous migrations)
-- No policy changes needed - existing policies cover the new column

-- Add helpful comment
COMMENT ON COLUMN app_settings.encrypted_openai_api_key IS 'Encrypted OpenAI API key for AI features. Encrypted using Supabase Vault or application-level encryption.';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 036: encrypted_openai_api_key column added to app_settings table.';
    RAISE NOTICE 'This column stores encrypted OpenAI API keys for AI features.';
    RAISE NOTICE 'The openai_api_key_set boolean indicates whether a key has been configured.';
END $$;
