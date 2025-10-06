-- Fix journal_entry_lines and journal_entries RLS policies to work with auto-generated entries

-- Fix journal_entries UPDATE policy
DROP POLICY IF EXISTS "Users can update own journal entries" ON journal_entries;
CREATE POLICY "Users can update own journal entries" ON journal_entries
    FOR UPDATE USING (user_id = auth.uid());

-- Fix journal_entry_lines INSERT policy
DROP POLICY IF EXISTS "Users can create journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can create journal entry lines" ON journal_entry_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_id
            AND je.user_id = auth.uid()
        )
    );

-- Fix journal_entry_lines UPDATE policy
DROP POLICY IF EXISTS "Users can update journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can update journal entry lines" ON journal_entry_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_id
            AND je.user_id = auth.uid()
        )
    );
