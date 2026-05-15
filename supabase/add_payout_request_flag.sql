ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_requested BOOLEAN DEFAULT false;
