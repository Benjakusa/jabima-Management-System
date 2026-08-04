# API Documentation

The Jabima Management System uses Supabase, which provides an auto-generated REST API (PostgREST) directly from the PostgreSQL database schema. This document outlines the primary API endpoints (tables) and custom Remote Procedure Calls (RPCs).

## Core Tables (REST Endpoints)
All tables can be accessed via standard Supabase client methods (`supabase.from('table_name').select()`, `.insert()`, `.update()`, `.delete()`). Access is governed by Row Level Security (RLS) policies based on the authenticated user's role.

### Authentication & Profiles
- `profiles`: Extended user data (Name, email, phone). Linked 1:1 with `auth.users`.
- `user_roles`: Maps `auth.users.id` to specific `app_role` enums (e.g., `admin`, `inventory_officer`).

### Inventory Module
- `inventory_materials`: Tracks raw materials (wood, fabric, hardware) used in production.
- `material_categories`: Categories for raw materials.
- `finished_products`: Completed products ready for sale, including custom names, source (workshop vs. external), and batch tracking.
- `shop_inventory`: Finished products assigned to specific branches for immediate sale.
- `interbranch_transfers`: Logs movement of items between warehouse, branches, and workshop.

### Production Module
- `production_orders`: Core table tracking a batch or single item through the manufacturing pipeline. Key fields: `current_stage`, `status` ('in_production', 'completed').
- `stage_assignments`: Maps which `workshop_worker` is responsible for which `production_stage`.
- `stage_logs`: Detailed tracking of when a worker starts and completes a specific stage on a production order.

### Sales Module
- `sales`: Records of sold products, capturing price, customer details, M-Pesa codes, and the responsible `sales_officer_id`.
- `service_sales`: Records of services rendered (e.g., transport, lowering gear hire).
- `instalment_schedule`: Tracks Lipa Pole Pole (installment) payment plans for specific sales.
- `sales_audit`: Read-only log of modifications made to sales by admins.

### Financials & Wallets
- `wallets`: Tracks earnings for workers and sales officers (`pending_earnings`, `approved_earnings`, `paid_earnings`).
- `wallet_transactions`: Ledger of all movements (earned commissions, approved payouts) in a wallet.
- `payout_requests`: Requests made by workers to withdraw their earnings.
- `payment_configs`: Rules defining how a worker earns money (e.g., daily wage, per-stage piece rate, commission percentage).

---

## Remote Procedure Calls (RPCs)
Complex operations that require atomic transactions or elevated privileges are handled via PostgreSQL functions (RPCs). They are called using `supabase.rpc('function_name', { args })`.

### `create_production_batch_multi`
Creates multiple production orders in a single atomic transaction, grouping them under one batch number.
- **Parameters:**
  - `p_items` (JSONB): Array of objects containing `product_type` and `quantity`.
  - `p_batch_number` (TEXT): Unique identifier for the batch.
  - `p_notes` (TEXT): Optional instructions.
  - `p_expected_completion_date` (DATE): Optional deadline.
  - `p_created_by` (UUID): User ID initiating the batch.
- **Returns:** SETOF `production_orders` created.

### `admin_edit_sale`
Safely edits an existing sale record. It handles reverting old commissions, returning the old product to inventory, marking the new product as sold, generating a new commission, updating installment schedules (if applicable), and logging the change in `sales_audit`.
- **Parameters:**
  - `p_sale_id` (UUID)
  - `p_new_price` (NUMERIC)
  - `p_new_customer` (TEXT)
  - `p_new_product_id` (UUID)
  - `p_admin_id` (UUID)
- **Returns:** void

### `update_production_order`
Safely updates a production order's details (like expected date or notes) while enforcing rules (e.g., cannot edit a completed order) and logging changes to `production_orders_audit`.
- **Parameters:**
  - `p_order_id` (UUID)
  - `p_product_type` (TEXT)
  - `p_notes` (TEXT)
  - `p_expected_date` (DATE)
  - `p_user_id` (UUID)
- **Returns:** void

### `credit_earnings` & `resolve_sales_commission`
Internal database functions used heavily by triggers and other RPCs to automatically calculate and credit worker wallets based on their `payment_configs` whenever a sale is made or a production stage is completed.
