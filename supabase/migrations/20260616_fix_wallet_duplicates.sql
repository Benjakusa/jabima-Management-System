-- ============================================================
-- Wallet Deduplication & Frontend Fetch Fix
-- ============================================================

BEGIN;

-- 1. Deduplicate Wallets (Keep the one with the highest earnings)
WITH RankedWallets AS (
  SELECT id,
         user_id,
         ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY (pending_earnings + approved_earnings + paid_earnings) DESC, updated_at DESC) as rn
  FROM public.wallets
)
DELETE FROM public.wallets WHERE id IN (SELECT id FROM RankedWallets WHERE rn > 1);

-- 2. Ensure UNIQUE constraint exists to prevent future duplicates
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_key;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);

-- 3. Update the credit_earnings function to be completely race-condition safe using UPSERT
CREATE OR REPLACE FUNCTION public.credit_earnings(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT,
  p_reference TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  -- Thread-safe get or create wallet
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_wallet_id;

  -- Dedup: skip if this reference was already credited
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = v_wallet_id AND reference_number = p_reference
  ) THEN
    RETURN;
  END IF;

  -- Credit pending earnings
  UPDATE public.wallets
  SET pending_earnings = pending_earnings + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id;

  -- Audit trail
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, reference_number)
  VALUES (v_wallet_id, p_amount, 'earned', p_description, p_reference);
END;
$$;

COMMIT;
