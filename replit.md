# BizCore Platform

## Overview

BizCore is a modular multi-tenant business operations SaaS platform targeting restaurants (expandable to retail/grocery/service). It provides a command center for managing locations, items, orders, employees, inventory, scheduling, and time tracking.

pnpm workspace monorepo using TypeScript throughout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (Node.js/Express backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (username/password + OAuth), `@clerk/express` server-side, `@clerk/react` client-side
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- **Frontend**: React + Vite, Tailwind CSS v4, shadcn/ui, wouter routing
- **Build**: esbuild (CJS bundle for API server)

## Architecture

### Packages

- `artifacts/api-server` — Express REST API, Clerk auth middleware, routes for businesses/locations/modules/dashboard
- `artifacts/web` — React + Vite SPA, Clerk-authenticated, module-aware sidebar navigation
- `lib/db` — Drizzle ORM schema + migrations (7 schema files)
- `lib/api-spec` — OpenAPI 3.0 spec + Orval codegen config
- `lib/api-client-react` — Generated React Query hooks (from Orval)
- `lib/api-zod` — Generated Zod schemas for server-side validation (from Orval)

### DB Schema Files (`lib/db/src/schema/`)

- `businesses.ts` — businesses, businessUsers, businessModules tables
- `items.ts` — menu items, categories, variants
- `inventory.ts` — inventory items and tracking
- `orders.ts` — orders and order items
- `employees.ts` — employees and time entries
- `recipes.ts` — recipe ingredients
- `custom-fields.ts` — custom field definitions and values

### API Routes

- `GET /api/health` — Health check
- `GET /api/businesses/me` — Get authenticated user's business
- `POST /api/businesses` — Create a business (one per user)
- `PATCH /api/businesses/:id` — Update business info
- `GET /api/locations` — List locations for the business
- `POST /api/locations` — Create a location
- `PATCH /api/locations/:id` — Update a location
- `DELETE /api/locations/:id` — Delete a location
- `GET /api/modules` — Get enabled modules
- `PUT /api/modules` — Update module configuration
- `GET /api/dashboard/summary` — Dashboard metrics (orders, sales, employees, low stock, time entries)

### Frontend Pages

- `/` — Public landing page (redirects signed-in users to /dashboard)
- `/sign-in/*?` — Clerk SignIn component
- `/sign-up/*?` — Clerk SignUp component
- `/onboarding` — Business setup wizard (shown when no business exists)
- `/dashboard` — Metrics dashboard with recent orders
- `/settings` — Business profile + module configuration
- `/locations` — Location CRUD management
- `/orders`, `/inventory`, `/employees`, `/schedule`, `/time-tracking`, `/reports` — Stub pages (show "Coming soon" when module enabled)

### Auth Flow

1. User signs in via Clerk
2. `PortalRouter` in `App.tsx` calls `GET /api/businesses/me`
3. If 404 → redirect to `/onboarding`
4. If found → redirect to `/dashboard`
5. Sidebar nav dynamically shows links based on enabled modules (`useGetModules()`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Roles

- `admin` / `owner` — Full access (business owner via `ownerUserId`)
- `manager` — Operational access (via `businessUsersTable`)
- `cashier` — POS-only
- `hr` — People management

## Multi-Tenancy

All data is scoped to `businessId`. The `loadBusiness` middleware injects `req.businessId` and `req.userRole` on every authenticated request. Business owners are identified via `businessesTable.ownerUserId` (Clerk user ID).

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `CLERK_SECRET_KEY` — Clerk server secret (managed by Clerk integration)
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (managed)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for frontend
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL (empty in dev, set in production)

## Modules

Available modules (can be enabled/disabled per business):
- `inventory` — Inventory tracking
- `orders` — Order management
- `employees` — Employee management
- `scheduling` — Shift scheduling
- `time_tracking` — Clock in/out
- `reports` — Business analytics
- `payroll_future` — Payroll (future)
- `recipes_future` — Recipe management (future)

Default enabled on business creation: `inventory`, `orders`, `employees`.
