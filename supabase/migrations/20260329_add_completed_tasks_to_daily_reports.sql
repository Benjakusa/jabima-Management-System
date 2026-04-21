ALTER TABLE daily_reports ADD COLUMN completed_tasks JSONB DEFAULT '[]'::jsonb;
