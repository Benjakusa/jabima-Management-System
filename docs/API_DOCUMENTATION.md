# Database & API Documentation

**PROPRIETARY & CONFIDENTIAL**  
*This document and the software it describes are the proprietary property of Jabima Funeral Directors and OpenDesk Infodigital (Lead Developer: Benard Oloo Ochieng, Phone: 0722839617). Unauthorized copying or distribution is strictly prohibited.*

---

## Overview

The Jabima Management System utilizes **PostgREST** (via Supabase) to expose a secure REST API directly from the PostgreSQL schema. There is no middle-tier Node.js application; the frontend communicates directly with the database. Security is enforced via Row Level Security (RLS).

This document outlines the core tables (which act as REST endpoints) and the custom Remote Procedure Calls (RPCs) that handle complex, multi-table transactions.

---

## I. Core REST Endpoints (Tables)

These endpoints are accessed via the Supabase client (e.g., `supabase.from('table_name').select()`).

### 1. Users, Roles, & Auth
- **`profiles`**: Extends the `auth.users` table. Contains `full_name`, `phone`, and `email`.
- **`user_roles`**: Maps a `user_id` to an `app_role` ENUM (`admin`, `inventory_officer`, `workshop_worker`, `sales_officer`). Used extensively in RLS policies.
- **`payment_configs`**: Defines the financial contract for a worker. Specifies if they are paid via `daily_wage`, `per_stage` (piece rate), `per_product`, or `commission`, along with the specific monetary `amount`.

### 2. Inventory & Supply Chain
- **`inventory_materials`**: Tracks raw materials (e.g., Wood, Varnish). Tracks `quantity`, `unit_cost`, and triggers `min_stock_level` alerts.
- **`finished_products`**: The core catalog of items ready for sale. Products can originate from the workshop (via `production_orders`) or be imported as external stock. Tracks `production_cost` and `status` ('in_production', 'completed', 'transferred', 'sold').
- **`shop_inventory`**: A subset table tracking exactly which `finished_products` are currently located at which retail `branch_id`.
- **`interbranch_transfers`**: An audit log of inventory movement between the warehouse and branches.
- **`material_requests`**: Workshop workers request raw materials via this table. Inventory officers approve/deny these requests.

### 3. Production Pipeline (Workshop)
- **`production_orders`**: The overarching tracker for a manufacturing job. Links to a specific `product_type`, tracks the `current_stage` (e.g., 'frame_body', 'sanding_paint'), and belongs to a specific `batch_number`.
- **`stage_assignments`**: Maps which worker is responsible for which stage of production.
- **`stage_logs`**: The granular time-tracking table. Records when a `worker_id` starts and completes a specific `stage` on a specific `production_order`.
- **`wp_daily_reports`**: Mandatory end-of-shift reports filed by workers detailing tasks completed.

### 4. Sales & Finance
- **`sales`**: Records of physical product sales. Captures `selling_price`, `customer_name`, `mpesa_code`, and links to the specific `finished_product_id`.
- **`service_sales`**: Records of non-physical sales (transport, grave digging, lowering gear).
- **`instalment_schedule`**: Tracks Lipa Pole Pole (installment) plans. Maps multiple partial payments against a single `sale_id`.
- **`sales_audit`**: An immutable ledger tracking modifications made to past sales by administrators (capturing old price, new price, old product, new product, and the admin ID).

### 5. Wallets (Automated Payroll)
- **`wallets`**: Each worker has one wallet tracking three balances: `pending_earnings`, `approved_earnings`, and `paid_earnings`.
- **`wallet_transactions`**: The ledger mapping exactly *why* money was added or removed from a wallet (e.g., "Earned 500 KES for completing Frame Assembly").
- **`payout_requests`**: Workers submit these to move funds from `approved` to `paid`.

---

## II. Remote Procedure Calls (RPCs)

For operations requiring complex logic, atomic transactions across multiple tables, or elevated privileges bypassing RLS, the system uses PostgreSQL Functions. These are called via `supabase.rpc('function_name', { args })`.

### `create_production_batch_multi`
Creates multiple production orders simultaneously under a single batch number. Essential for bulk manufacturing.
- **Arguments:**
  - `p_items` (JSONB): E.g., `[{ "product_type": "Executive Casket", "quantity": 5 }]`
  - `p_batch_number` (TEXT)
  - `p_notes` (TEXT)
  - `p_expected_completion_date` (DATE)
  - `p_created_by` (UUID)
- **Logic:** Iterates through the JSON array, generates unique product codes, and atomicly inserts records into `production_orders`.
- **Returns:** SETOF `production_orders`.

### `admin_edit_sale`
A highly complex, safe method for an administrator to correct a mistake in a previously recorded sale.
- **Arguments:** `p_sale_id`, `p_new_price`, `p_new_customer`, `p_new_product_id`, `p_admin_id`.
- **Logic:**
  1. Reverts the old commission from the sales officer's wallet.
  2. If the product changed, reverts the old product's status back to 'completed' and re-inserts it into `shop_inventory`.
  3. Marks the *new* product as 'sold' and removes it from `shop_inventory`.
  4. Recalculates outstanding installment schedules if applicable.
  5. Calculates and credits the *new* commission to the sales officer.
  6. Logs the entire event in `sales_audit`.
- **Returns:** void.

### `update_production_order`
Allows updating an active production order's metadata while maintaining an audit trail.
- **Arguments:** `p_order_id`, `p_product_type`, `p_notes`, `p_expected_date`, `p_user_id`.
- **Logic:** Prevents editing of 'completed' orders. Logs the old vs new values into `production_orders_audit`, then updates the `production_orders` table.

### `resolve_sales_commission` (Internal DB Function)
- **Logic:** Not called directly by the frontend. This function is invoked by database triggers whenever a row is inserted into `sales`. It looks up the sales officer's `payment_configs`, calculates their commission based on the `selling_price`, and automatically credits their `wallet`.
