# Jabima Funeral Directors Management System

**PROPRIETARY & CONFIDENTIAL**  
*This software is the proprietary property of Jabima Funeral Directors and OpenDesk Infodigital. Unauthorized copying, distribution, or use is strictly prohibited.*

## System Overview

The Jabima Management System is a comprehensive, enterprise-grade, role-based ERP designed specifically to handle the complex, multi-faceted operations of a modern funeral home. Built from the ground up for performance and scalability, the system bridges the gap between manufacturing (workshop operations), supply chain (inventory management), retail (sales & branch management), and payroll (automated commissions & wages).

By digitizing operations that historically relied on manual ledgers, this system provides real-time visibility into branch stock levels, active production bottlenecks, raw material shortages, and daily revenue streams.

## Core Capabilities

### 🏢 Multi-Branch Retail & Inventory
- **Real-time Stock Tracking:** Unified view of stock levels across the main warehouse and distributed branches.
- **Inter-branch Transfers:** Secure, auditable workflow for moving stock (e.g., from Warehouse to Branch A), complete with transit statuses.
- **External Imports:** Capability to seamlessly import and track stock manufactured by third-party suppliers.

### 🏭 Workshop & Production Pipeline
- **Stage-Gate Manufacturing:** Tracks products (e.g., caskets) as they move through specific production stages: Wood Cutting, Frame/Body Assembly, Sanding/Paint, Cloth/Lining, and Glass/Finish.
- **Batch Processing:** Support for multi-product batches with atomic database insertions.
- **Live Floor Visibility:** Real-time dashboards showing active workers, idle orders, and daily production throughput.

### 💳 Point of Sale & Customer Finance
- **Direct & Service Sales:** Support for selling physical products (caskets) alongside services (lowering gear, transport).
- **Lipa Pole Pole (Installments):** Built-in financing module to manage partial payments, track outstanding balances, and auto-recalculate installments when adjustments occur.
- **Professional Receipts:** Automated generation of Thermal (POS) and standard A4 receipts.

### 💰 Automated Payroll & Worker Wallets
- **Algorithmic Commissions:** The system automatically calculates and credits worker wallets based on complex rules (e.g., daily wages, per-stage completion, or percentage of total sale).
- **Digital Wallets:** Workers can track their pending, approved, and paid earnings in real-time.
- **Payout Workflow:** Formal request and approval pipeline for salary/commission disbursements.

---

## Technical Foundation

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Backend (BaaS):** Supabase (PostgreSQL, Auth, Storage).
- **Mobile-Ready:** PWA configured and Capacitor integrated for native Android/iOS deployment.
- **Data Integrity:** Heavy reliance on PostgreSQL RPCs, Triggers, and strict Row Level Security (RLS) to ensure financial accuracy and prevent unauthorized data mutations.

---

## Comprehensive Documentation

For a deep dive into the system's inner workings, please consult the `docs/` directory:

1. **[Architecture Overview](./docs/ARCHITECTURE.md)** - Details the tech stack, directory structure, module breakdown, and database trigger flows.
2. **[User Roles & Security](./docs/USER_ROLES.md)** - Explains the RBAC model, detailing exact permissions for Admins, Sales, Inventory, and Workshop staff.
3. **[API & Database Schema](./docs/API_DOCUMENTATION.md)** - Documents the PostgREST API, critical PostgreSQL tables, Enums, and custom RPCs.

---

## Developer Contact

This application was engineered by **OpenDesk Infodigital**.

**Lead Software Developer:** Benard Oloo Ochieng  
**Phone:** +254 722 839 617  
**Organization:** OpenDesk Infodigital  

---

## Getting Started (Development)

### Prerequisites
- Node.js (v18+)
- npm
- Supabase Project (Database & Auth setup)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd jfd
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the project root and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

### Build & Deploy
To create a production build:
```bash
npm run build
```
The optimized assets will be generated in the `dist` directory, ready to be deployed to Vercel, Netlify, or any static hosting provider.

---

## License & Copyright

**PROPRIETARY AND CONFIDENTIAL**

This software and its documentation are the proprietary property of **Jabima Funeral Directors** and **OpenDesk Infodigital**.

- **Lead Software Developer:** Benard Oloo Ochieng
- **Organization:** OpenDesk Infodigital
- **Phone:** +254 722 839 617

Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited. See the `LICENSE` file in the root directory for full details.