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

- `artifacts/api-server` — Express REST API, Clerk auth middleware, routes for businesses/locations/modules/dashboard/items/categories/inventory/recipes/employees/scheduling
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
- `PATCH /api/businesses/:id` — Update business info (admin only)
- `GET /api/locations` — List locations for the business
- `POST /api/locations` — Create a location (admin/manager)
- `PATCH /api/locations/:id` — Update a location (admin/manager)
- `DELETE /api/locations/:id` — Delete a location (admin only)
- `GET /api/modules` — Get enabled modules
- `PUT /api/modules` — Update module configuration (admin only)
- `GET /api/dashboard/summary` — Dashboard metrics (orders, sales, employees, low stock, time entries)
- `POST /api/users/sync` — Sync Clerk user profile to local users table (called on sign-in)
- `GET /api/business-users` — List team members for the business (admin/manager)
- `POST /api/business-users` — Assign or update a user's role + location (admin only)
- `DELETE /api/business-users/:id` — Deactivate a team member (admin only)
- `GET /api/categories` — List categories for the business
- `POST /api/categories` — Create a category (validates business ownership)
- `PATCH /api/categories/:id` — Update a category
- `DELETE /api/categories/:id` — Delete a category
- `GET /api/items` — List items with search/type/category/active filters
- `POST /api/items` — Create an item (validates categoryId ownership)
- `PATCH /api/items/:id` — Update an item (validates categoryId ownership)
- `DELETE /api/items/:id` — Delete an item
- `GET /api/items/:itemId/variants` — List variants for an item
- `POST /api/items/:itemId/variants` — Create a variant
- `PATCH /api/variants/:id` — Update a variant (with tenant check via parent item)
- `DELETE /api/variants/:id` — Delete a variant (with tenant check via parent item)
- `GET /api/items/:itemId/recipe` — Get recipe for a menu item
- `PUT /api/items/:itemId/recipe` — Upsert recipe (validates all ingredientVariantIds belong to business)
- `GET /api/inventory` — List inventory for a location (search/category/type/lowStock filters)
- `PATCH /api/inventory/:id` — Update inventory entry threshold (with tenant check)
- `GET /api/inventory/transactions` — List transaction history
- `POST /api/inventory/transactions` — Record an inventory transaction (atomic quantity update)
- `GET /api/inventory/low-stock` — Get all low stock items across locations
- `GET /api/employee-roles` — List employee roles for the business
- `POST /api/employee-roles` — Create a role (admin/manager)
- `PATCH /api/employee-roles/:id` — Rename a role (admin/manager)
- `DELETE /api/employee-roles/:id` — Delete a role (admin/manager)
- `GET /api/employees` — List employees (search/locationId/roleId/active filters)
- `GET /api/employees/:id` — Get a single employee (with role + location names)
- `POST /api/employees` — Create an employee (admin/manager; validates role + location ownership)
- `PATCH /api/employees/:id` — Update an employee (admin/manager)
- `DELETE /api/employees/:id` — Soft-deactivate an employee (sets active=false)
- `GET /api/shifts` — List shifts (locationId, employeeId, from, to filters); includes `hasConflict` flag per shift
- `POST /api/shifts` — Create a shift (admin/manager; validates employee + location ownership; conflict detection)
- `PATCH /api/shifts/:id` — Update a shift (admin/manager)
- `DELETE /api/shifts/:id` — Delete a shift (admin/manager)
- `GET /api/time-entries` — List time entries (employeeId, locationId, status, from, to filters; includes durationMinutes)
- `POST /api/time-entries/clock-in` — Clock in an employee (admin/manager; 409 if already clocked in; validates employee + location tenant ownership)
- `POST /api/time-entries/:id/clock-out` — Clock out an open entry (admin/manager; tenant-scoped via employee join)
- `POST /api/time-entries/:id/approve` — Approve a completed time entry (admin/manager; sets approvedBy to Clerk userId)
- `POST /api/time-entries/:id/reject` — Reject a time entry with required reason (admin/manager)
- `POST /api/time-entries/:id/resubmit` — Resubmit a rejected entry with corrected clockIn/clockOut (admin/manager; resets status to pending; 400 if not rejected)

### Tenant Isolation

- `lib/tenantScope.ts` — `tenantWhere(col, businessId, ...extra)` helper used in all business-scoped DB queries; `assertBusinessId(id?)` throws 400 if missing context
- All mutations on business-scoped resources verify `businessId` matches the authenticated user's business
- Cross-tenant IDOR prevented in business-users endpoints via AND(id, businessId) predicates

### Auth Flow

1. User signs in via Clerk
2. `UserSyncEffect` in `App.tsx` calls `POST /api/users/sync` (best-effort, non-blocking) to sync Clerk profile to local `users` table
3. `PortalRouter` in `App.tsx` calls `GET /api/businesses/me`
4. If 404 → redirect to `/onboarding`
5. If found → redirect to `/dashboard`
6. Sidebar nav dynamically shows links based on enabled modules (`useGetModules()`)

### Frontend Pages

- `/` — Public landing page (redirects signed-in users to /dashboard)
- `/sign-in/*?` — Clerk SignIn component
- `/sign-up/*?` — Clerk SignUp component
- `/onboarding` — Business setup wizard (shown when no business exists)
- `/dashboard` — Metrics dashboard with recent orders and low stock count
- `/settings` — Business profile + module configuration + Team Members management
- `/locations` — Location CRUD management
- `/items` — Items management: products/ingredients/menu items CRUD with search/filter; CategoryManagerSheet for category CRUD; VariantsSheet with Variants tab + Recipe tab (for menu items) including recipe editor
- `/inventory` — Inventory management: location-scoped stock table with type/category/low-stock filters; record transactions; set low stock thresholds; transaction log tab
- `/customers` — Customer management: searchable table with create/edit dialogs, customer detail sheet, order history count
- `/orders` — Order management: state machine (pending→confirmed→preparing→ready→completed/cancelled), status history, role-based permissions
- `/employees` — Employee management: searchable/filterable table by role, location, active status; create/edit dialogs; RolesManagerSheet for CRUD on job roles; EmployeeDetailSheet; active/deactivate toggle
- `/schedule` — Shift calendar with Week/Day view toggle: week view is a 7-column day grid (click a day header to jump to day view); day view groups shifts by employee with time/location/notes; shared add/edit/delete dialogs; location filter; conflict badges; nav arrows + today button
- `/time-tracking` — Time entry management: 3 tabs (All/Pending/Open), clock-in dialog, clock-out action, approve/reject with required reason, resubmit dialog for rejected entries (shows rejection reason, editable clockIn/clockOut/notes); stat cards for open/pending/total counts
- `/reports` — Stub page (Coming soon)

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
