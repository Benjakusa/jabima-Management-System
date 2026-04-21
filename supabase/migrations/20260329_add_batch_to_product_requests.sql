-- Add batch_number to product_requests for tracking which batch fulfilled the request
ALTER TABLE product_requests ADD COLUMN batch_number TEXT;
