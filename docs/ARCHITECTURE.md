# Architecture Overview

**PROPRIETARY & CONFIDENTIAL**  
*This document and the software it describes are the proprietary property of Jabima Funeral Directors and OpenDesk Infodigital (Lead Developer: Benard Oloo Ochieng, Phone: 0722839617). Unauthorized copying or distribution is strictly prohibited.*

---

## Executive Architecture Summary

The Jabima Management System is engineered as a modern, decoupled, serverless-first Web Application. It utilizes a Single Page Application (SPA) frontend architecture communicating directly with a Backend-as-a-Service (BaaS) provider. This architectural choice prioritizes rapid development, real-time synchronization, edge-network performance, and cross-platform compatibility (Web, Android, iOS).

## Core Technology Stack

### 1. Frontend: The Presentation Layer
- **Framework:** **React 18** (built with **Vite** for optimized Hot Module Replacement and lightning-fast production builds).
- **Language:** **TypeScript**. Strict typing prevents runtime errors, ensures self-documenting code, and enforces rigid interfaces between the frontend and database schemas.
- **State Management & Data Fetching:** **React Query (TanStack Query v5)**. Used for fetching, caching, synchronizing, and updating server state. It minimizes redundant network requests and handles pagination/optimistic updates seamlessly.
- **Styling Engine:** **Tailwind CSS**. A utility-first CSS framework allowing for rapid UI iteration without bloated stylesheets.
- **Component Library:** **shadcn/ui** (built on Radix UI primitives). Provides fully accessible, unstyled components that are composed and styled via Tailwind to match the proprietary Jabima brand identity.
- **Form Handling:** **React Hook Form** combined with **Zod** for rigorous client-side schema validation before data ever touches the network.
- **Mobile Enablement:** **Capacitor** is configured to wrap the Vite web build into native Android and iOS applications, utilizing a unified codebase for web and mobile.

### 2. Backend: The Data & Logic Layer (Supabase)
Supabase serves as the entire backend infrastructure, eliminating the need to write or maintain a traditional Node.js/Python middleware server.

- **Relational Database:** **PostgreSQL 15+**. The absolute core of the system. It handles all relational data, foreign key constraints, and transactional integrity.
- **API Generation:** **PostgREST**. Supabase automatically introspects the PostgreSQL schema and exposes a secure, instant RESTful API.
- **Authentication:** **Supabase Auth (GoTrue)**. Handles JWT issuance, session management, and password hashing.
- **Realtime:** **Supabase Realtime**. Leverages PostgreSQL replication slots to broadcast database changes via WebSockets, powering live dashboards (e.g., live workshop production views).
- **Business Logic:** Because there is no traditional middleware server, all heavy business logic (e.g., calculating commissions, multi-table atomic updates, reverting inventory on sale cancellation) is written directly into the database using **PostgreSQL Functions (RPCs)** and **Triggers**.

---

## Directory Structure Deep Dive

The repository follows a feature/module-based architecture:

```text
jfd/
├── src/
│   ├── components/       # React components organized by business domain
│   │   ├── admin/        # Executive dashboards, user management
│   │   ├── inventory/    # Stock taking, material requests, transfers
│   │   ├── production/   # Pipeline tracking, batch creation
│   │   ├── sales/        # Point of Sale, receipts, installment tracking
│   │   ├── worker/       # Workshop floor interfaces, daily reports
│   │   └── ui/           # Generic, reusable UI primitives (buttons, dialogs)
│   ├── contexts/         # React Context providers (AuthContext, ThemeContext)
│   ├── hooks/            # Custom reusable React hooks (e.g., useMobile)
│   ├── integrations/     
│   │   └── supabase/     # Supabase client instantiation and auto-generated TS types
│   ├── lib/              # Utility functions (formatting dates, currency, class merging)
│   └── pages/            # High-level route components mapping to the URL structure
├── supabase/
│   └── migrations/       # Immutable, sequential SQL files defining the database state. 
│                         # This is the single source of truth for the backend.
├── public/               # Static assets (favicons, manifests for PWA)
└── android/ & ios/       # Capacitor generated native project files
```

---

## Key Architectural Patterns

### 1. "Thick Database" Pattern
Unlike traditional apps that put logic in a Node.js server, Jabima puts logic in Postgres. 
- *Example:* When a worker completes a stage, a frontend React component simply does `supabase.from('stage_logs').insert(...)`. 
- A Postgres `TRIGGER` detects this insert, checks the `payment_configs` table, calculates the exact monetary value of that labor, and automatically issues an `UPDATE` to the `wallets` table.
- This ensures that **no matter how the data is inserted**, the financial calculations are guaranteed to run correctly.

### 2. Role-Based Access via RLS
Security is handled at the database row level. A JWT is passed with every PostgREST request containing the user's UUID. PostgreSQL evaluates Row Level Security (RLS) policies (e.g., `SELECT * FROM sales WHERE branch_id = my_branch`) before returning data. This means the frontend code does not need complex security filtering logic.

### 3. Progressive Web App (PWA)
The application leverages the Vite PWA plugin to generate service workers and manifest files. This allows the application to be installed on desktop and mobile devices directly from the browser, offering offline caching of static assets to improve load times in low-connectivity environments (like remote warehouse locations).
