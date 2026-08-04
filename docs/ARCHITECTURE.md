# Jabima Management System Architecture

## Overview
Jabima Management System is a modern, role-based ERP (Enterprise Resource Planning) tailored for funeral home operations. It manages inventory, production, sales, employee earnings (commissions/wages), and administrative reporting.

## Tech Stack
### Frontend
- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Routing:** React Router DOM
- **State Management:** React Query (TanStack Query) for asynchronous state management and caching.
- **Styling:** Tailwind CSS
- **UI Components:** shadcn-ui (Radix UI primitives with Tailwind)
- **Forms:** React Hook Form with Zod for validation
- **Charts:** Recharts
- **PWA:** Vite PWA Plugin for offline support and progressive web app capabilities.
- **Mobile Support:** Capacitor (Android & iOS integration)

### Backend (Supabase)
- **Database:** PostgreSQL (managed by Supabase)
- **Authentication:** Supabase Auth (Email/Password based, role-based access)
- **API:** PostgREST (auto-generated REST API from PostgreSQL schema)
- **Logic:** PostgreSQL Functions (RPCs) and Database Triggers for complex business logic (e.g., wallet commission calculations, batch multi-product inserts).
- **Realtime:** Supabase Realtime subscriptions (e.g., admin dashboard updates).

## Application Structure
- `/src/components`: UI components organized by module (admin, inventory, production, sales, worker, ui, etc.).
- `/src/contexts`: React Contexts (e.g., `AuthContext` for user session and role management).
- `/src/hooks`: Custom React Hooks.
- `/src/integrations/supabase`: Supabase client initialization and auto-generated TypeScript types.
- `/src/lib`: Utility functions.
- `/src/pages`: Main application routes/pages.
- `/supabase/migrations`: PostgreSQL schema definitions, triggers, and RPCs.

## Core Modules
1. **Admin Dashboard:** High-level overview of business metrics (revenue, production, inventory values) and branch management.
2. **Inventory Management:** Tracking raw materials, finished products, and service equipment. Supports external stock and branch transfers.
3. **Production/Workshop:** Managing the manufacturing pipeline. Orders move through stages (e.g., Frame/Body, Sanding/Paint, Cloth/Lining, Glass/Finish). Workers log stage completions.
4. **Sales & Receipts:** Processing product and service sales, including installment plans (Lipa Pole Pole). Generates thermal and A4 receipts.
5. **Worker Wallets:** Automated tracking of worker earnings (wages, commissions per stage/product) and payout requests.
