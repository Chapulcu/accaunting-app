-- Muhasebe Kayıtları (Yevmiye) Tablosu
CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_number TEXT,
    description TEXT NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('invoice', 'payment', 'manual', 'opening', 'closing')),
    reference_id INTEGER,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    total_debit DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    posted_at TIMESTAMPTZ,
    UNIQUE(user_id, entry_number)
);

-- Muhasebe Detayları Tablosu
CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit = 0 OR credit = 0)  -- Bir satırda sadece borç veya alacak olabilir
);

-- Indexes
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

-- RLS Policies - Journal Entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries" ON journal_entries
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create journal entries" ON journal_entries
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update draft journal entries" ON journal_entries
    FOR UPDATE USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Users can delete draft journal entries" ON journal_entries
    FOR DELETE USING (user_id = auth.uid() AND status = 'draft');

-- RLS Policies - Journal Entry Lines
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entry lines" ON journal_entry_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create journal entry lines" ON journal_entry_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

CREATE POLICY "Users can update journal entry lines" ON journal_entry_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

CREATE POLICY "Users can delete journal entry lines" ON journal_entry_lines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

-- Triggers
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_journal_entry_lines_updated_at
    BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function: Yevmiye toplamlarını otomatik hesapla ve dengele
CREATE OR REPLACE FUNCTION calculate_journal_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    -- Toplam borç ve alacak hesapla
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    -- Yevmiye toplamlarını güncelle
    UPDATE journal_entries
    SET
        total_debit = v_total_debit,
        total_credit = v_total_credit
    WHERE id = NEW.journal_entry_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_journal_totals
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_journal_totals();

-- Function: Yevmiye kaydını deftere kaydet (post)
CREATE OR REPLACE FUNCTION post_journal_entry(p_journal_entry_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    -- Borç ve alacak toplamlarını kontrol et
    SELECT total_debit, total_credit
    INTO v_total_debit, v_total_credit
    FROM journal_entries
    WHERE id = p_journal_entry_id;

    -- Borç ve alacak eşit olmalı
    IF v_total_debit != v_total_credit THEN
        RAISE EXCEPTION 'Borç ve alacak tutarları eşit olmalı. Borç: %, Alacak: %', v_total_debit, v_total_credit;
    END IF;

    -- En az bir satır olmalı
    IF v_total_debit = 0 THEN
        RAISE EXCEPTION 'Yevmiye kaydı en az bir borç veya alacak satırı içermelidir';
    END IF;

    -- Durumu posted olarak güncelle
    UPDATE journal_entries
    SET
        status = 'posted',
        posted_at = NOW()
    WHERE id = p_journal_entry_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- View: Hesap bakiyeleri
CREATE OR REPLACE VIEW account_balances AS
SELECT
    a.id,
    a.user_id,
    a.code,
    a.name,
    a.type,
    COALESCE(SUM(jel.debit), 0) as total_debit,
    COALESCE(SUM(jel.credit), 0) as total_credit,
    CASE
        WHEN a.type IN ('asset', 'expense') THEN COALESCE(SUM(jel.debit - jel.credit), 0)
        WHEN a.type IN ('liability', 'equity', 'income') THEN COALESCE(SUM(jel.credit - jel.debit), 0)
    END as balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE a.is_active = true
GROUP BY a.id, a.user_id, a.code, a.name, a.type;
