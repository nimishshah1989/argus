-- Revert of 0008_ai_suggestion.sql (ticket 55). destructive-approved: drops only ai_suggestion.
-- backup: pg_dump --table=ai_suggestion before running wherever the table holds rows.
BEGIN;
DROP TABLE ai_suggestion;  -- its indexes, constraints and policy go with it
DO $$ BEGIN
  IF to_regclass('public.schema_migration') IS NOT NULL THEN
    DELETE FROM schema_migration WHERE filename = '0008_ai_suggestion.sql';
  END IF;
END $$;
COMMIT;
