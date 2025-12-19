-- Migration 031: Feature Flags for n8n and AI Features
--
-- Purpose: Add feature flag columns to app_settings table to control
-- optional automation and AI features. All features are disabled by default
-- and can be enabled independently without affecting core functionality.

-- Add feature flag columns to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS n8n_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS n8n_webhook_base_url TEXT,
ADD COLUMN IF NOT EXISTS ai_ocr_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_categorization_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_predictions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_chatbot_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS openai_api_key_set BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN app_settings.n8n_enabled IS 'Enable n8n workflow automation (invoice approval, payment reminders, recurring invoices, data sync, e-invoice automation)';
COMMENT ON COLUMN app_settings.n8n_webhook_base_url IS 'Base URL for n8n webhook endpoints (e.g., http://localhost:5678)';
COMMENT ON COLUMN app_settings.ai_ocr_enabled IS 'Enable AI OCR for invoice and receipt scanning using GPT-4 Vision';
COMMENT ON COLUMN app_settings.ai_categorization_enabled IS 'Enable AI-powered auto-categorization for expenses and invoices';
COMMENT ON COLUMN app_settings.ai_predictions_enabled IS 'Enable AI financial predictions (cash flow, revenue, payment probability)';
COMMENT ON COLUMN app_settings.ai_chatbot_enabled IS 'Enable AI chatbot assistant for queries and guidance';
COMMENT ON COLUMN app_settings.openai_api_key_set IS 'Indicator for frontend whether OpenAI API key is configured (for conditional rendering)';

-- Update existing app_settings rows to have default values
UPDATE app_settings
SET
  n8n_enabled = COALESCE(n8n_enabled, false),
  ai_ocr_enabled = COALESCE(ai_ocr_enabled, false),
  ai_categorization_enabled = COALESCE(ai_categorization_enabled, false),
  ai_predictions_enabled = COALESCE(ai_predictions_enabled, false),
  ai_chatbot_enabled = COALESCE(ai_chatbot_enabled, false),
  openai_api_key_set = COALESCE(openai_api_key_set, false)
WHERE id IS NOT NULL;

-- Add index for faster feature flag lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_feature_flags
ON app_settings (n8n_enabled, ai_ocr_enabled, ai_categorization_enabled, ai_predictions_enabled, ai_chatbot_enabled);

-- Notify that migration completed
DO $$
BEGIN
  RAISE NOTICE 'Migration 031: Feature flags added to app_settings. All features are disabled by default.';
  RAISE NOTICE 'Features can be enabled independently from Settings page without affecting core functionality.';
END $$;
