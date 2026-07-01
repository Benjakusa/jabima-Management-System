-- Prevent duplicate shop_inventory entries for the same product at the same branch
ALTER TABLE public.shop_inventory
ADD CONSTRAINT shop_inventory_unique_product_branch
UNIQUE (finished_product_id, branch_id);
