# Jabima Funeral Directors Management System

A comprehensive, role-based Enterprise Resource Planning (ERP) system tailored for funeral home operations. Built with modern web technologies, it manages inventory, production pipelines, sales, installment plans, and automated worker commissions.

## Features
- **Multi-Branch Inventory:** Track raw materials, service equipment, and finished products across multiple physical locations.
- **Production Pipeline:** Manage workshop manufacturing workflows with stage-by-stage tracking and batch processing.
- **Sales & Point of Sale:** Process direct sales and services, generate thermal/A4 receipts, and manage Lipa Pole Pole (installment) plans.
- **Automated Payroll & Wallets:** Automatically calculate worker wages and commissions based on completed tasks or sales, tracked in personal digital wallets.
- **Role-Based Access Control:** Distinct interfaces and capabilities for Admins, Inventory Officers, Workshop Workers, and Sales Officers.

## Documentation
Detailed documentation is available in the `docs` directory:
- [Architecture Overview](./docs/ARCHITECTURE.md) - Tech stack, module breakdown, and folder structure.
- [User Roles & Permissions](./docs/USER_ROLES.md) - Detailed breakdown of system roles and access levels.
- [API Documentation](./docs/API_DOCUMENTATION.md) - Database schema, REST endpoints, and custom PostgreSQL RPCs.

## Tech Stack
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **Mobile Integration:** Capacitor (Android & iOS).

## Prerequisites
- Node.js & npm
- A Supabase Project (for backend services)

## Getting Started

```sh
# 1. Install dependencies
npm install

# 2. Set up environment variables
# Copy .env.example to .env and add your Supabase URL and Anon Key
cp .env.example .env

# 3. Start development server
npm run dev
```

## Available Scripts
- `npm run dev` - Start the development server with auto-reloading
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm run test` - Run tests

## Deployment
Build the project using `npm run build` and deploy the `dist` folder to your preferred hosting provider (e.g., Vercel, Netlify). Ensure your Supabase migrations are pushed to your production database.