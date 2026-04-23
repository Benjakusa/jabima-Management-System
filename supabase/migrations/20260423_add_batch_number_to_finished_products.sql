-- Add missing columns to finished_products table

-- Basic columns that might be missing
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2);
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS location TEXT;

-- Add index for batch_number lookups
CREATE INDEX IF NOT EXISTS idx_finished_products_batch_number ON finished_products(batch_number);
CREATE INDEX IF NOT EXISTS idx_finished_products_source_type ON finished_products(source_type);