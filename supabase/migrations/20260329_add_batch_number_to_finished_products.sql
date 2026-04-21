-- Add batch_number field to finished_products for external products
ALTER TABLE finished_products ADD COLUMN batch_number TEXT;
