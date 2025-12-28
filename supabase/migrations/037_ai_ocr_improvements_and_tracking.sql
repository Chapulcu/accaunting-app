-- Migration 037: AI OCR Improvements and Accuracy Tracking
--
-- Purpose: Add feedback tracking, accuracy metrics, and performance improvements
-- for AI OCR features

-- Add feedback and accuracy columns to ai_training_data
ALTER TABLE ai_training_data
ADD COLUMN IF NOT EXISTS feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
ADD COLUMN IF NOT EXISTS feedback_comment TEXT,
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_correct BOOLEAN,
ADD COLUMN IF NOT EXISTS correction_data JSONB,
ADD COLUMN IF NOT EXISTS reused_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reused_at TIMESTAMPTZ;

-- Add batch processing tracking
CREATE TABLE IF NOT EXISTS ocr_batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    batch_name TEXT,
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    successful_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    -- Performance metrics
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_processing_time_ms BIGINT,
    average_file_time_ms INTEGER,

    -- Metadata
    entity_type TEXT CHECK (entity_type IN ('invoice', 'expense', 'receipt')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for feedback queries
CREATE INDEX IF NOT EXISTS idx_ai_training_feedback_rating ON ai_training_data(feedback_rating) WHERE feedback_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_training_is_correct ON ai_training_data(is_correct) WHERE is_correct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_training_source_type ON ai_training_data(source_type);
CREATE INDEX IF NOT EXISTS idx_ocr_batch_jobs_user_status ON ocr_batch_jobs(user_id, status);

-- Function to calculate OCR accuracy by source type
CREATE OR REPLACE FUNCTION get_ocr_accuracy_stats(
    p_user_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    source_type TEXT,
    total_processed BIGINT,
    total_verified BIGINT,
    total_correct BIGINT,
    accuracy_rate NUMERIC,
    average_confidence NUMERIC,
    average_processing_time_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.source_type,
        COUNT(*) as total_processed,
        COUNT(*) FILTER (WHERE t.is_verified = true) as total_verified,
        COUNT(*) FILTER (WHERE t.is_correct = true) as total_correct,
        ROUND(
            (COUNT(*) FILTER (WHERE t.is_correct = true)::NUMERIC /
             NULLIF(COUNT(*) FILTER (WHERE t.is_verified = true), 0)) * 100,
            2
        ) as accuracy_rate,
        ROUND(AVG(t.confidence_score), 2) as average_confidence,
        ROUND(AVG(t.processing_time_ms))::INTEGER as average_processing_time_ms
    FROM ai_training_data t
    WHERE (p_user_id IS NULL OR t.user_id = p_user_id)
      AND (p_source_type IS NULL OR t.source_type = p_source_type)
      AND t.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
      AND t.status = 'completed'
    GROUP BY t.source_type
    ORDER BY total_processed DESC;
END;
$$;

-- Function to get top performing OCR confidence ranges
CREATE OR REPLACE FUNCTION get_ocr_confidence_distribution(
    p_user_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    confidence_range TEXT,
    count BIGINT,
    accuracy_when_verified NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN confidence_score >= 90 THEN '90-100%'
            WHEN confidence_score >= 80 THEN '80-89%'
            WHEN confidence_score >= 70 THEN '70-79%'
            WHEN confidence_score >= 60 THEN '60-69%'
            ELSE '<60%'
        END as confidence_range,
        COUNT(*) as count,
        ROUND(
            (COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC /
             NULLIF(COUNT(*) FILTER (WHERE is_verified = true), 0)) * 100,
            2
        ) as accuracy_when_verified
    FROM ai_training_data
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_source_type IS NULL OR source_type = p_source_type)
      AND status = 'completed'
    GROUP BY
        CASE
            WHEN confidence_score >= 90 THEN '90-100%'
            WHEN confidence_score >= 80 THEN '80-89%'
            WHEN confidence_score >= 70 THEN '70-79%'
            WHEN confidence_score >= 60 THEN '60-69%'
            ELSE '<60%'
        END
    ORDER BY
        CASE confidence_range
            WHEN '90-100%' THEN 1
            WHEN '80-89%' THEN 2
            WHEN '70-79%' THEN 3
            WHEN '60-69%' THEN 4
            ELSE 5
        END;
END;
$$;

-- Function to record OCR feedback
CREATE OR REPLACE FUNCTION record_ocr_feedback(
    p_training_data_id UUID,
    p_is_correct BOOLEAN,
    p_feedback_rating INTEGER DEFAULT NULL,
    p_feedback_comment TEXT DEFAULT NULL,
    p_correction_data JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_training_data
    SET
        is_correct = p_is_correct,
        feedback_rating = p_feedback_rating,
        feedback_comment = p_feedback_comment,
        feedback_at = NOW(),
        correction_data = p_correction_data,
        is_verified = true,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_training_data_id;
END;
$$;

-- Function to track OCR reuse
CREATE OR REPLACE FUNCTION increment_ocr_reuse(
    p_training_data_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_training_data
    SET
        reused_count = reused_count + 1,
        last_reused_at = NOW(),
        updated_at = NOW()
    WHERE id = p_training_data_id;
END;
$$;

-- Function to get similar OCR results (for suggestions)
CREATE OR REPLACE FUNCTION find_similar_ocr_results(
    p_vendor_name TEXT,
    p_document_number TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source_type TEXT,
    extracted_data JSONB,
    confidence_score DECIMAL,
    is_correct BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.source_type,
        t.extracted_data,
        t.confidence_score,
        t.is_correct,
        t.created_at
    FROM ai_training_data t
    WHERE t.status = 'completed'
      AND (p_user_id IS NULL OR t.user_id = p_user_id)
      AND (
          -- Match vendor name
          t.extracted_data->>'vendor_name' ILIKE '%' || p_vendor_name || '%'
          OR
          -- Match document number if provided
          (p_document_number IS NOT NULL AND
           t.extracted_data->>'document_number' = p_document_number)
      )
    ORDER BY
        -- Prioritize verified and correct results
        CASE WHEN t.is_correct = true THEN 1 ELSE 2 END,
        t.confidence_score DESC,
        t.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Create view for OCR performance dashboard
CREATE OR REPLACE VIEW ocr_performance_dashboard AS
SELECT
    COUNT(*) as total_ocr_requests,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_requests,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_requests,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
         NULLIF(COUNT(*), 0)) * 100,
        2
    ) as success_rate,
    ROUND(AVG(confidence_score), 2) as avg_confidence,
    ROUND(AVG(processing_time_ms), 0)::INTEGER as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE is_verified = true) as verified_count,
    COUNT(*) FILTER (WHERE is_correct = true) as correct_count,
    ROUND(
        (COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC /
         NULLIF(COUNT(*) FILTER (WHERE is_verified = true), 0)) * 100,
        2
    ) as accuracy_rate,
    SUM(reused_count) as total_reuses,
    COUNT(DISTINCT source_type) as entity_types_processed
FROM ai_training_data
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Enable RLS for new tables
ALTER TABLE ocr_batch_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for ocr_batch_jobs
CREATE POLICY "Users can view own batch jobs"
    ON ocr_batch_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own batch jobs"
    ON ocr_batch_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch jobs"
    ON ocr_batch_jobs FOR UPDATE
    USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON FUNCTION get_ocr_accuracy_stats IS 'Calculate OCR accuracy statistics by source type';
COMMENT ON FUNCTION get_ocr_confidence_distribution IS 'Get distribution of OCR results by confidence range';
COMMENT ON FUNCTION record_ocr_feedback IS 'Record user feedback on OCR results';
COMMENT ON FUNCTION increment_ocr_reuse IS 'Track when OCR results are reused';
COMMENT ON FUNCTION find_similar_ocr_results IS 'Find similar previous OCR results for suggestions';
COMMENT ON VIEW ocr_performance_dashboard IS 'Dashboard metrics for OCR performance and accuracy';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 037: AI OCR improvements and tracking created successfully.';
    RAISE NOTICE 'New columns: feedback_rating, is_correct, correction_data, reused_count';
    RAISE NOTICE 'New table: ocr_batch_jobs for batch processing tracking';
    RAISE NOTICE 'New functions: get_ocr_accuracy_stats, record_ocr_feedback, find_similar_ocr_results';
    RAISE NOTICE 'New view: ocr_performance_dashboard';
END $$;
