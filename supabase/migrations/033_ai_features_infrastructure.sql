-- Migration 033: AI Features Infrastructure (OPTIONAL)
--
-- Purpose: Create tables and functions for AI features
-- This migration is OPTIONAL - only run if AI features will be used
-- All AI features are controlled by individual feature flags (ai_ocr_enabled, ai_categorization_enabled, etc.)

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- AI training data and OCR results table
CREATE TABLE IF NOT EXISTS ai_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Source
    source_type TEXT NOT NULL CHECK (source_type IN ('invoice', 'receipt', 'document', 'expense')),
    source_id INTEGER, -- invoice_id, expense_id, etc.
    image_url TEXT,
    file_storage_path TEXT,

    -- OCR Results
    extracted_data JSONB, -- GPT-4 Vision extraction results
    confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- Human verification (supervised learning)
    is_verified BOOLEAN DEFAULT false,
    verified_data JSONB,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,

    -- Processing
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_time_ms INTEGER,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI predictions table (forecasts, probabilities, anomalies)
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    prediction_type TEXT NOT NULL CHECK (prediction_type IN ('cash_flow', 'revenue', 'payment_probability', 'anomaly', 'category', 'custom')),

    -- Target
    target_entity_type TEXT, -- 'invoice', 'company', 'account', 'customer'
    target_entity_id INTEGER,

    -- Prediction data
    prediction_data JSONB NOT NULL, -- Forecast values, probabilities, etc.
    confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- Time range
    prediction_date DATE, -- Date for which prediction is made
    created_for_date DATE DEFAULT CURRENT_DATE, -- Date when prediction was created

    -- Accuracy tracking
    actual_value DECIMAL(15,2),
    accuracy_score DECIMAL(5,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 100),

    -- Metadata
    model_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI categorization rules table
CREATE TABLE IF NOT EXISTS ai_categorization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'regex', 'amount_range', 'ai_learned', 'custom')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('expense', 'invoice', 'payment')),

    -- Rule definition
    pattern TEXT, -- Keyword or regex pattern
    amount_min DECIMAL(15,2),
    amount_max DECIMAL(15,2),
    vendor_name_pattern TEXT,

    -- Target category
    target_category_id INTEGER,
    target_category_name TEXT,

    -- Accuracy tracking
    match_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2), -- (correct_count / match_count) * 100

    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority rules are checked first

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_amount_range CHECK (amount_min IS NULL OR amount_max IS NULL OR amount_min <= amount_max)
);

-- AI chat history table
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    session_id UUID NOT NULL,
    message_role TEXT NOT NULL CHECK (message_role IN ('user', 'assistant', 'system')),
    message_content TEXT NOT NULL,

    -- Context
    context_entity_type TEXT, -- 'invoice', 'dashboard', 'report', etc.
    context_entity_id INTEGER,
    context_data JSONB,

    -- Token usage tracking
    tokens_used INTEGER,
    model_used TEXT, -- 'gpt-4', 'gpt-3.5-turbo', etc.

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document embeddings table for semantic search
CREATE TABLE IF NOT EXISTS ai_document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'expense', 'note', 'customer', 'product')),
    document_id INTEGER NOT NULL,

    -- Content
    content_text TEXT NOT NULL,
    content_hash TEXT, -- For duplicate detection

    -- Embedding vector (OpenAI ada-002 dimension = 1536)
    embedding vector(1536),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint to prevent duplicate embeddings
    UNIQUE (document_type, document_id, content_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_training_data_user_id ON ai_training_data(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_source ON ai_training_data(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_status ON ai_training_data(status);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_user_id ON ai_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_date ON ai_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_ai_categorization_rules_user_id ON ai_categorization_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_categorization_rules_active ON ai_categorization_rules(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_id ON ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_session ON ai_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_user_id ON ai_document_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_document ON ai_document_embeddings(document_type, document_id);

-- Vector similarity search index (using HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_vector ON ai_document_embeddings
USING hnsw (embedding vector_cosine_ops);

-- Enable Row Level Security
ALTER TABLE ai_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Simple ownership model
CREATE POLICY "Users can manage own AI training data"
    ON ai_training_data FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI predictions"
    ON ai_predictions FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own categorization rules"
    ON ai_categorization_rules FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat history"
    ON ai_chat_history FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own document embeddings"
    ON ai_document_embeddings FOR ALL
    USING (auth.uid() = user_id);

-- Function to update categorization rule accuracy
CREATE OR REPLACE FUNCTION update_categorization_rule_accuracy(
    p_rule_id UUID,
    p_was_correct BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_categorization_rules
    SET
        match_count = match_count + 1,
        correct_count = CASE WHEN p_was_correct THEN correct_count + 1 ELSE correct_count END,
        accuracy_rate = ((CASE WHEN p_was_correct THEN correct_count + 1 ELSE correct_count END)::DECIMAL / (match_count + 1)::DECIMAL) * 100,
        updated_at = NOW()
    WHERE id = p_rule_id;
END;
$$;

-- Function to find similar documents using vector search
CREATE OR REPLACE FUNCTION find_similar_documents(
    p_embedding vector(1536),
    p_document_type TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    document_type TEXT,
    document_id INTEGER,
    content_text TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.document_type,
        e.document_id,
        e.content_text,
        1 - (e.embedding <=> p_embedding) AS similarity,
        e.metadata
    FROM ai_document_embeddings e
    WHERE
        (p_user_id IS NULL OR e.user_id = p_user_id)
        AND (p_document_type IS NULL OR e.document_type = p_document_type)
    ORDER BY e.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$;

-- Function to get categorization rules for entity
CREATE OR REPLACE FUNCTION get_active_categorization_rules(
    p_entity_type TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    rule_type TEXT,
    pattern TEXT,
    amount_min DECIMAL,
    amount_max DECIMAL,
    vendor_name_pattern TEXT,
    target_category_id INTEGER,
    target_category_name TEXT,
    accuracy_rate DECIMAL,
    priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.rule_type,
        r.pattern,
        r.amount_min,
        r.amount_max,
        r.vendor_name_pattern,
        r.target_category_id,
        r.target_category_name,
        r.accuracy_rate,
        r.priority
    FROM ai_categorization_rules r
    WHERE r.entity_type = p_entity_type
        AND r.user_id = p_user_id
        AND r.is_active = true
    ORDER BY r.priority DESC, r.accuracy_rate DESC NULLS LAST;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE ai_training_data IS 'AI training data and OCR results from GPT-4 Vision';
COMMENT ON TABLE ai_predictions IS 'AI predictions for cash flow, revenue, payment probability, anomalies';
COMMENT ON TABLE ai_categorization_rules IS 'Rules for automatic categorization of expenses and invoices';
COMMENT ON TABLE ai_chat_history IS 'Chat history for AI assistant conversations';
COMMENT ON TABLE ai_document_embeddings IS 'Document embeddings for semantic search using vector similarity';
COMMENT ON FUNCTION update_categorization_rule_accuracy IS 'Update categorization rule accuracy based on user feedback';
COMMENT ON FUNCTION find_similar_documents IS 'Find similar documents using vector similarity search';
COMMENT ON FUNCTION get_active_categorization_rules IS 'Get active categorization rules for entity type';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 033: AI features infrastructure created successfully.';
    RAISE NOTICE 'Tables: ai_training_data, ai_predictions, ai_categorization_rules, ai_chat_history, ai_document_embeddings';
    RAISE NOTICE 'This infrastructure is optional and controlled by AI feature flags.';
    RAISE NOTICE 'pgvector extension enabled for semantic search capabilities.';
END $$;
