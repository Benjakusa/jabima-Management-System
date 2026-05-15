ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_request_amount DECIMAL(10,2) DEFAULT 0;
