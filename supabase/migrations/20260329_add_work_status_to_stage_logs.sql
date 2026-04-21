-- Add work_status column to stage_logs
ALTER TABLE stage_logs
ADD COLUMN work_status TEXT DEFAULT 'started' CHECK (work_status IN ('started', 'midway', 'completed'));

-- Update existing logs to have 'completed' status if they have completed_at
UPDATE stage_logs SET work_status = 'completed' WHERE completed_at IS NOT NULL;

-- Set default for new inserts
ALTER TABLE stage_logs ALTER COLUMN work_status SET DEFAULT 'started';
ALTER TABLE stage_logs ALTER COLUMN work_status SET NOT NULL;
