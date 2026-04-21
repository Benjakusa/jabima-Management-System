-- Migration: Add external purchase fields to finished_products
-- Date: 2026-03-29

-- 1. Create the product_source enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE product_source AS ENUM ('workshop', 'external');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to finished_products
ALTER TABLE public.finished_products
ADD COLUMN IF NOT EXISTS source_type product_source,
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS name TEXT;

-- 3. Make production_order_id nullable (for external purchases)
ALTER TABLE public.finished_products
ALTER COLUMN production_order_id DROP NOT NULL;

-- 4. Update existing rows to mark them as workshop products
UPDATE public.finished_products
SET source_type = 'workshop'
WHERE source_type IS NULL;

-- 5. Set default for source_type
ALTER TABLE public.finished_products
ALTER COLUMN source_type SET DEFAULT 'workshop';

-- 6. Add NOT NULL constraint back with default
ALTER TABLE public.finished_products
ALTER COLUMN source_type SET NOT NULL;

-- 7. Add RLS policy for finished_products (if not exists)
DO $$ BEGIN
    CREATE POLICY "allow_all_auth_finished_products" ON public.finished_products 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 8. Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'finished_products' 
ORDER BY ordinal_position;
