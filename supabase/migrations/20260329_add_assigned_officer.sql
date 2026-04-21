-- Add assigned_officer_id to track which worker picked a task
ALTER TABLE production_orders
ADD COLUMN assigned_officer_id UUID REFERENCES profiles(user_id);

-- Create index for faster queries
CREATE INDEX idx_production_orders_assigned_officer ON production_orders(assigned_officer_id) WHERE assigned_officer_id IS NOT NULL;
