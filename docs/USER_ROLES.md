# User Roles and Security Architecture

**PROPRIETARY & CONFIDENTIAL**  
*This document and the software it describes are the proprietary property of Jabima Funeral Directors and OpenDesk Infodigital (Lead Developer: Benard Oloo Ochieng, Phone: 0722839617). Unauthorized copying or distribution is strictly prohibited.*

---

## Security Philosophy

The Jabima Management System operates on a strict **Zero-Trust Role-Based Access Control (RBAC)** model. Security is not just enforced at the UI level (hiding buttons/routes), but fundamentally at the database level using **PostgreSQL Row Level Security (RLS)**. Even if a malicious actor accesses the Supabase REST API directly, the database engine will reject unauthorized queries based on the authenticated user's assigned role.

## System Roles (`app_role` ENUM)

The system defines several core roles to map directly to business operations. A user's role is stored in the `user_roles` table, which links `auth.users.id` to the `app_role` enum.

### 1. Administrator (`admin`)
The system administrator is the super-user of the platform, holding ultimate authority over all data and system configurations.

**Key Capabilities:**
- **Financial Oversight:** Unrestricted access to revenue dashboards, expense tracking, and overall profit/loss analytics.
- **User Management:** Create employee accounts, deactivate users, and assign system roles.
- **Payroll & Wallets:** Configure worker payment structures (e.g., setting commission percentages or piece-rate amounts per production stage). Final authority to approve and mark payout requests as "Paid".
- **Audit & Correction:** The only role capable of modifying historical data. Admins use the `admin_edit_sale` RPC to correct erroneous sales, ensuring all changes are logged immutably in the `sales_audit` table.
- **Catalog Management:** Add or disable product designs, material categories, and branch locations.

### 2. Inventory Officer (`inventory_officer`)
The gatekeeper of physical assets, responsible for supply chain tracking, raw materials, and finished goods inventory.

**Key Capabilities:**
- **Raw Materials Management:** Log new deliveries of raw materials (wood, fabric, hardware), track unit costs, and configure minimum stock alerts.
- **Workshop Fulfillment:** Review and approve `material_requests` made by workshop workers, automatically deducting approved quantities from raw material inventory.
- **Finished Goods Processing:** Receive completed products from the workshop into the main warehouse.
- **External Imports:** Bulk import products manufactured by third parties directly into the finished goods inventory.
- **Branch Logistics:** Initiate and approve `interbranch_transfers` to move stock from the warehouse to specific retail branches.

### 3. Workshop Worker (`workshop_worker`)
The production staff responsible for assembling, finishing, and packaging products. Their interactions are tightly scoped to the manufacturing floor.

**Key Capabilities:**
- **Stage Progression:** View `production_orders` assigned to the workshop. Start, work on, and complete specific stages (e.g., Frame/Body, Painting, Glass Fitting).
- **Material Requisition:** Submit `material_requests` to the inventory officer when raw materials run low on the floor.
- **Daily Reporting:** Submit mandatory `wp_daily_reports` summarizing tasks completed during their shift.
- **Automated Earnings:** As they log completed stages, the system automatically calculates their earnings based on their specific `payment_configs`.
- **Wallet Access:** View their personal wallet balance (Pending vs. Approved earnings) and initiate payout requests. They **cannot** see the wallets of other workers.

### 4. Sales Officer (`sales_officer`)
Frontline retail staff interacting directly with clients at specific branch locations.

**Key Capabilities:**
- **Direct Sales:** Sell physical products currently available in their specific branch's `shop_inventory`.
- **Service Sales:** Process transactions for non-physical services (e.g., transport, lowering gear rental).
- **Financing Management:** Initiate and track Lipa Pole Pole (Installment) plans. Log subsequent customer payments against active plans.
- **Receipt Generation:** Generate and reprint thermal or A4 receipts for customers.
- **Commission Tracking:** View their personal wallet to track accumulated sales commissions. They **cannot** alter prices below configured thresholds without admin approval.

### 5. Specialized Roles
The system accommodates specific operational niches:
- **`driver`:** Assigned to logistics, viewing transport schedules and vehicle assignments.
- **`lowering_gear_operator`:** Specialized service staff, tracking equipment dispatch and service execution.
- **`branch_manager`:** Has elevated privileges over a specific branch, able to view localized sales reports and manage local inventory transfers.
- **`accountant`:** Read-only access to deep financial data, focusing on reconciliation, tax reporting, and audit logs without the ability to mutate operational data.

---

## Row Level Security (RLS) Implementation

Supabase RLS acts as the ultimate enforcer. Policies are written in raw SQL.

**Example: Wallet Protection**
```sql
-- A worker can only view their own wallet
CREATE POLICY "Users can view own wallet" ON public.wallets 
  FOR SELECT USING (auth.uid() = user_id);

-- Only an admin can update wallet balances
CREATE POLICY "Admins can update wallets" ON public.wallets 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

By binding application logic tightly to the PostgreSQL user context (`auth.uid()`), Jabima Management System guarantees that data boundaries are strictly maintained, preventing lateral privilege escalation.
