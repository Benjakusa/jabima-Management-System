-- ============================================================
-- Wallet Configuration Module Enhancement
-- Adds stage_label and product_type_id to payment_configs
-- Safe to run multiple times (idempotent)
-- ============================================================

-- Add stage_label: stores human-readable stage name (e.g. "Stage 1 — Frame and body assembly")
ALTER TABLE public.payment_configs
  ADD COLUMN IF NOT EXISTS stage_label TEXT;

-- Add product_type_id: references the products table for workshop config
ALTER TABLE public.payment_configs
  ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Add percentage column for explicit storage of sales commission %
ALTER TABLE public.payment_configs
  ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2);
