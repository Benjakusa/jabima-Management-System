-- 1. Ensure columns exist before creating function
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_requested BOOLEAN DEFAULT false;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_request_amount DECIMAL(10,2) DEFAULT 0;

-- 2. Create SECURE RPC function to bypass wallets RLS and prevent tampering
CREATE OR REPLACE FUNCTION public.request_wallet_payout(p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
BEGIN
  -- Authenticate and get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Validate amount
  IF p_amount <= 0 OR p_amount > v_wallet.pending_earnings THEN
    RAISE EXCEPTION 'Invalid payout amount requested';
  END IF;

  -- Update wallet flags
  UPDATE public.wallets 
  SET 
    payout_requested = true, 
    payout_request_amount = p_amount 
  WHERE id = v_wallet.id;

  -- Log transaction
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description)
  VALUES (
    v_wallet.id, 
    p_amount, 
    'earned', 
    'Requested Payout of Ksh ' || p_amount::text
  );
END;
$$;
