# User Roles and Permissions

Jabima Management System implements a strict Role-Based Access Control (RBAC) system utilizing Supabase Row Level Security (RLS) policies and frontend route protection.

## Roles (`app_role` ENUM)

### 1. Admin (`admin`)
The system administrator with unrestricted access to all modules and data.
- **Capabilities:**
  - View comprehensive business dashboards (revenue, expenses, production stats).
  - Manage user profiles, assign roles, and configure worker payment structures (wages/commissions).
  - Edit sales records safely via the `admin_edit_sale` RPC (maintaining audit trails).
  - Approve and process worker payout requests.
  - Manage branches, material categories, and product designs.
  - View live workshop overviews.

### 2. Inventory Officer (`inventory_officer`)
Responsible for managing stock levels and supply chain logistics.
- **Capabilities:**
  - Add and manage raw materials, finished products, and service equipment.
  - Bulk import external/purchased products.
  - Fulfill or reject material requests from the workshop.
  - Manage inter-branch inventory transfers.
  - Monitor stock alerts and generate inventory reports.

### 3. Workshop Worker (`workshop_worker`)
Employees responsible for manufacturing and preparing products.
- **Capabilities:**
  - View assigned production stages (e.g., Wood Cutting, Painting).
  - Start, advance, and complete production tasks on specific orders.
  - Request raw materials from the inventory officer.
  - Submit daily reports of completed work.
  - View their personal wallet, tracking earnings from completed stages or daily wages.
  - Request payouts for earned wages.

### 4. Sales Officer (`sales_officer`)
Handles customer interactions, selling products and services.
- **Capabilities:**
  - Process direct sales for products available in their branch/shop inventory.
  - Process service sales.
  - Manage Installment plans (Lipa Pole Pole).
  - Generate and print receipts (Thermal or A4 format).
  - Earn and track sales commissions via their personal wallet.

### 5. Other specialized roles
- `driver`: Handles transport logistics.
- `lowering_gear_operator`: Operates specific funeral equipment.
- `branch_manager`: Oversees specific branch operations.
- `accountant`: Handles deep financial reporting and reconciliation.

## Security (Row Level Security - RLS)
Data access is enforced at the database level. For example:
- `sales` and `wallets` are generally only readable by the owner (the officer) or an `admin`.
- `wp_daily_reports` can only be inserted/viewed by the specific `workshop_worker` or an `admin`.
- `finished_products` can be added by `inventory_officer` or `admin`.
