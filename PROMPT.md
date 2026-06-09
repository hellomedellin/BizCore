# BizCore — Business Operations Platform

You are acting as a senior software architect, product architect, database architect, and full-stack engineer.

Your job is not simply to generate code. Your job is to design and build a scalable, multi-tenant business operations platform that can evolve for years without major architectural rewrites.

Challenge poor design decisions, identify future limitations, and propose better alternatives when appropriate. When making architectural decisions, explain tradeoffs and why one approach is preferred over another.

---

## Product Vision

Build a modular, API-first business operations platform that supports any type of business through a shared core architecture and a configurable module system.

This platform is **not** built for restaurants specifically. It is built for any business that needs to track resources, inventory, labor, sales, and operations. Examples:

- Restaurants and coffee shops
- Tire shops and auto repair
- Salons and spas
- Retail stores (shoes, clothing, gifts, electronics)
- Grocery stores
- Mixed businesses operating multiple types simultaneously

A single business may operate a restaurant and a gift shop at the same location. The platform must support this without separate systems or data duplication.

**The goal is a flexible core configured for any business — not separate solutions per industry.**

---

## Core Philosophy

### Resource Consumption Model

Many businesses do not sell finished, pre-stocked products. They consume underlying resources when serving a customer.

- A restaurant sells a burger → consumes beef, bun, lettuce, tomato, cheese
- A coffee shop sells a latte → consumes espresso, milk, syrup, cup
- An auto shop performs an oil change → consumes oil, filter, and labor time
- A salon colors hair → consumes dye, developer, and labor time

This is modeled as **Consumption Profiles** — a generic concept that replaces the restaurant-specific notion of "recipes." A consumption profile defines what resources are consumed when a product or service is delivered.

**Never use restaurant-specific terminology in the codebase.** Avoid: `recipe`, `menu_item`, `ingredient` as a type. Use instead: `consumption_profile`, `output_item`, `resource_item`.

### Finished-Goods Model

Other businesses stock and sell finished products directly:

- Shoe stores track inventory by SKU (size, color)
- Clothing stores track by variant
- Electronics stores track by serial number or unit

Both models — resource-based and finished-goods — must be supported through the same inventory system without duplication.

### Not Every Business Uses Every Feature

A tire shop does not need consumption profiles that look like food recipes. A shoe store does not need employee scheduling. A solo consultant does not need multi-location inventory.

**The module system — not hardcoded conditionals — determines what each business sees and uses.**

---

## Onboarding

The signup and onboarding flow is critical. It configures the entire experience for a business.

### Onboarding Wizard Steps

1. **Account creation** — owner creates a user account (email + password or OAuth)
2. **Business info** — business name, country, currency (one currency per business, set at signup, used for all monetary values), primary timezone
3. **Business type selection** — owner selects one or more business types from a defined list; this pre-fills the module selection in the next step
4. **Module selection** — a checklist of available modules, pre-checked based on business type; owner can add or remove any module
5. **First location setup** — name, address, phone, timezone (may differ from business timezone), type (restaurant, retail, service, etc.)
6. **Done** — redirect to dashboard

### Business Type Templates

These are starting suggestions only. The owner can always change module selections.

| Business Type | Pre-enabled Modules |
|---|---|
| Restaurant / Food Service | Inventory, Consumption Profiles, Orders, Customers, Employees, Time Tracking, Purchasing, Invoice AI |
| Coffee Shop | Inventory, Consumption Profiles, Orders, Customers, Employees, Time Tracking, Purchasing, Invoice AI |
| Auto Repair / Tire Shop | Inventory, Consumption Profiles, Service Orders, Customers, Employees, Time Tracking, Purchasing, Invoice AI |
| Salon / Spa | Inventory, Consumption Profiles, Service Orders, Customers, Employees, Time Tracking, Scheduling |
| Retail Store | Inventory, Orders, Customers, Employees, Purchasing, Invoice AI |
| Mixed / Custom | Owner selects all modules manually |

### Important Onboarding Rules

- Business type selection only pre-fills modules — it does not lock the schema or code paths
- No feature in the codebase should check `business.type` to conditionally change behavior; use the module system instead
- After onboarding, modules can be enabled or disabled from business settings at any time

---

## Multi-Tenancy

Every piece of data belongs to a business. All database tables carry `business_id`. All API queries are scoped to the authenticated business.

- A business has one owner (the account that signed up)
- A business has multiple locations
- A business has team members (employees) with roles and permissions
- Each location has its own timezone, address, and operational type
- A business may be a mixed operation (restaurant location + retail location) — this is modeled through location types, not a business-level type field

**There is no cross-business data access under any circumstances.**

---

## Module System

Modules are the primary gating mechanism. A business enables or disables modules during onboarding and from settings.

Available modules:

| Module Key | Description |
|---|---|
| `inventory` | Track stock levels, transfers, adjustments, low-stock alerts |
| `consumption_profiles` | Define resource consumption rules for products and services |
| `orders` | Create and manage sales orders (dine-in, pickup, delivery, retail, service) |
| `customers` | Customer directory and order history |
| `employees` | Employee records, roles, and permissions |
| `time_tracking` | Clock in/out, breaks, time-off requests, approval workflow |
| `scheduling` | Shift scheduling and conflict detection |
| `purchasing` | Purchase orders and supplier management |
| `invoice_ai` | Upload invoices, AI-extracted line items, review and apply to inventory |
| `reporting` | Business reports (sales, inventory, labor hours) |
| `api_access` | Generate API keys for external integrations (POS systems, etc.) |

### Module Rules

- The frontend renders navigation and features based on enabled modules only
- The API enforces module access — a disabled module returns `403` even if the endpoint is called directly
- `businessModulesTable` stores `{ businessId, module, enabled, configuration: jsonb }` — the `configuration` field holds per-module settings (e.g., inventory costing method: FIFO or weighted average; auto-deplete inventory on order completion: yes/no)
- Module configuration has a defined schema per module — do not store arbitrary blobs

---

## Tech Stack

### Hosting: AWS

All infrastructure runs on AWS.

| Layer | Technology | Rationale |
|---|---|---|
| Database | **PostgreSQL on AWS RDS** | Managed, reliable, supports all query patterns needed |
| API server | **Node.js + Express on AWS ECS (Fargate)** | Containerized, scalable, persistent DB connections (prefer over Lambda for connection pool efficiency) |
| Frontend | **React + Vite → S3 + CloudFront** | Static hosting, globally fast, zero server management |
| File storage | **AWS S3** | Invoice PDFs, images, attachments |
| Async jobs | **AWS SQS + Lambda** | Invoice AI processing queue — decoupled from API response |
| Auth | **Clerk** | Handles user accounts, sessions, OAuth; syncs to local `users` table on first sign-in |
| AI / Invoice | **Anthropic Claude API** | Best-in-class document extraction for invoice parsing |
| Cache (future) | **AWS ElastiCache (Redis)** | For session data and rate limiting when needed |

### Application Stack

| Layer | Technology |
|---|---|
| Package manager | pnpm workspaces (monorepo) |
| Language | TypeScript (strict mode throughout) |
| ORM | Drizzle ORM |
| Validation | Zod (runtime validation at API boundaries) |
| API contract | OpenAPI 3.0 spec (single source of truth) |
| API codegen | Orval → React Query hooks + Zod schemas generated from OpenAPI spec |
| Frontend UI | React 19 + Tailwind CSS v4 + shadcn/ui (Radix UI primitives) |
| Routing | wouter (lightweight) |
| Data fetching | React Query |
| Animations | Framer Motion |
| Logging | Pino (structured JSON logs) |
| Build | esbuild (API), Vite (frontend) |

### Monorepo Structure

```
/
├── artifacts/
│   ├── api-server/          # Express API (runs on ECS)
│   └── web/                 # React SPA (deploys to S3)
├── lib/
│   ├── db/                  # Drizzle schema + migrations
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   └── api-zod/             # Generated Zod server schemas
└── scripts/                 # Seed, migration, deploy scripts
```

---

## Database Schema Design

### Non-Negotiable Rules

1. All monetary values are stored as `numeric(10, 2)` — never `float`, never `integer` cents
2. Every business-scoped table carries `business_id uuid NOT NULL` with a foreign key and an index
3. All primary keys are `uuid` generated by PostgreSQL using `gen_random_uuid()` as the column default — never `serial`, never application-generated UUIDs; in Drizzle use `uuid("id").primaryKey().defaultRandom()`
4. Timestamps are always `timestamp with time zone` — never `timestamp` without timezone
5. Soft deletes: use `active boolean` or `deleted_at timestamptz` — never hard-delete business data
6. Text enums (item type, order status, etc.) must have a `CHECK` constraint or use a Drizzle enum — unvalidated text columns are not acceptable for fields with a known value set
7. The `units` table is global (no `business_id`) — it is seeded at deployment and shared across all tenants; businesses cannot delete system units but may add custom ones

### businesses

```
id uuid PK
name text NOT NULL
owner_user_id text NOT NULL          -- Clerk user ID
currency_code char(3) NOT NULL       -- ISO 4217: "USD", "COP", "CAD"
timezone text NOT NULL               -- IANA timezone: "America/Bogota"
logo_url text
phone text
email text
address text
created_at timestamptz
updated_at timestamptz
```

Note: No `industry` or `type` field on businesses. Business character is determined by enabled modules and location types.

### locations

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL
type text NOT NULL                   -- "restaurant", "retail", "service", "warehouse", "office"
address text
phone text
timezone text NOT NULL               -- IANA timezone — may differ from business timezone
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

### business_modules

```
id uuid PK
business_id uuid FK → businesses
module text NOT NULL                 -- matches module key enum
enabled boolean DEFAULT true
configuration jsonb                  -- per-module typed config (validated at application layer)
created_at timestamptz
updated_at timestamptz

UNIQUE (business_id, module)
```

### users

```
id text PK                           -- Clerk user ID (not a uuid — use Clerk's ID directly)
email text NOT NULL
name text
created_at timestamptz
updated_at timestamptz
```

### business_users

```
id uuid PK
business_id uuid FK → businesses
user_id text FK → users              -- Clerk user ID
role text NOT NULL                   -- "owner", "admin", "manager", "staff", "viewer"
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz

UNIQUE (business_id, user_id)
```

Note: `business_users` controls app access and role. A single user may belong to multiple businesses.

### business_user_locations

```
id uuid PK
business_user_id uuid FK → business_users
location_id uuid FK → locations
created_at timestamptz

UNIQUE (business_user_id, location_id)
```

Enables staff to work across multiple locations.

**Critical access control rule:** If a `business_user` has zero rows in `business_user_locations`, they have access to ALL locations for that business. This is intentional for owners and admins who manage everything. If any location rows exist, access is restricted to only those locations. This rule must be enforced in the auth middleware on every request — not in individual route handlers. A helper `getUserLocations(businessUserId)` should return either `null` (meaning all locations) or an array of location IDs to filter by.

---

### Items

The `items` table is the central catalog for everything a business tracks — physical products, services, resources, and anything that can be sold, consumed, or stocked.

### items

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL
description text
type text NOT NULL                   -- ENUM: "product", "resource", "service", "bundle"
                                     -- product: finished good sold directly (shoe, t-shirt)
                                     -- resource: raw material consumed by other items (beef, oil, dye)
                                     -- service: labor/time-based (haircut, oil change labor)
                                     -- bundle: a fixed set of items sold together
category_id uuid FK → categories
base_price numeric(10,2)
cost numeric(10,2)                   -- default/base cost; actual cost from purchase orders overrides
track_inventory boolean DEFAULT true
has_variants boolean DEFAULT false
image_url text
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

### item_variants

```
id uuid PK
item_id uuid FK → items
name text NOT NULL                   -- "Small", "Red / Size 10", "Default"
sku text
price numeric(10,2)                  -- overrides item base_price if set
cost numeric(10,2)                   -- overrides item cost if set
attributes jsonb                     -- { "size": "10", "color": "Red" }
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

Every item has at least one variant. Items without real variants get a single "Default" variant created automatically. This keeps the inventory model uniform — `inventory` always references a variant, never an item directly.

### categories

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL
parent_id uuid FK → categories       -- supports subcategories
sort_order integer DEFAULT 0
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

---

### Units of Measure

A first-class UoM system is required. Without it, inventory reconciliation between purchasing (beef received in lbs) and consumption (beef consumed in grams) will produce incorrect results.

### units

```
id uuid PK
name text NOT NULL                   -- "grams", "kilograms", "liters", "each", "hours"
abbreviation text NOT NULL           -- "g", "kg", "L", "ea", "hr"
unit_type text NOT NULL              -- ENUM: "mass", "volume", "length", "count", "time"
conversion_to_base numeric(18,8)     -- multiplier to convert to base unit for this type
                                     -- base units: gram (mass), milliliter (volume), each (count), minute (time)
is_system boolean DEFAULT false      -- system units are seeded and cannot be deleted
created_at timestamptz
```

Seed the following units at minimum: g, kg, oz, lb (mass); ml, L, fl_oz, cup, gal (volume); each, dozen, case (count); minute, hour (time).

---

### Inventory

### inventory

```
id uuid PK
variant_id uuid FK → item_variants
location_id uuid FK → locations
quantity numeric(10,3) NOT NULL DEFAULT 0
unit_id uuid FK → units              -- the unit this quantity is measured in
low_stock_threshold numeric(10,3)
created_at timestamptz
updated_at timestamptz

UNIQUE (variant_id, location_id)
```

### inventory_transactions

```
id uuid PK
variant_id uuid FK → item_variants
location_id uuid FK → locations
type text NOT NULL                   -- ENUM: "receive", "consume", "adjust", "transfer_in",
                                     --       "transfer_out", "waste", "return"
quantity_change numeric(10,3) NOT NULL  -- positive = stock increases; negative = decreases
unit_id uuid FK → units
reference_type text                  -- "order", "purchase_order", "transfer", "adjustment"
reference_id uuid                    -- polymorphic FK to the source record
batch_id text                        -- for lot/batch tracking (future)
expires_at timestamptz               -- for expiry tracking (future)
notes text
created_by text                      -- user_id or "system"
created_at timestamptz
```

---

### Consumption Profiles

Defines what resources are consumed when an item (product or service) is produced or delivered. This is the generalized form of what a restaurant would call a recipe.

### consumption_profiles

```
id uuid PK
business_id uuid FK → businesses
output_item_id uuid FK → items       -- the item this profile produces
output_variant_id uuid FK → item_variants  -- NULL = applies to all variants; set = variant-specific
name text                            -- optional label ("Standard", "Large Size", "Weekend Special")
notes text
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

Resolution order: if a variant-specific profile exists for the ordered variant, use it; otherwise fall back to the item-level profile (where `output_variant_id IS NULL`).

### consumption_profile_lines

```
id uuid PK
profile_id uuid FK → consumption_profiles
line_type text NOT NULL              -- ENUM: "resource", "labor"

-- For line_type = "resource" (these columns are NULL when line_type = "labor"):
resource_variant_id uuid FK → item_variants  -- nullable
quantity numeric(10,4)                        -- nullable
unit_id uuid FK → units                       -- nullable

-- For line_type = "labor" (these columns are NULL when line_type = "resource"):
role_id uuid FK → employee_roles     -- nullable; NULL = any role
labor_minutes numeric(8,2)           -- nullable

created_at timestamptz
```

**Nullability rule:** Every column in this table is nullable except `id`, `profile_id`, `line_type`, and `created_at`. For `line_type = "resource"`, the columns `resource_variant_id`, `quantity`, and `unit_id` must be non-null (enforce via application-layer validation, not DB constraint, since DB CHECK across nullable columns is complex). For `line_type = "labor"`, the column `labor_minutes` must be non-null; `role_id` is optional.

Labor lines allow service businesses (auto shop, salon) to record expected labor time per service. When a service order is completed, labor lines can generate suggested time entries.

---

### Orders

### orders

```
id uuid PK
business_id uuid FK → businesses
location_id uuid FK → locations
customer_id uuid FK → customers      -- nullable
order_type text NOT NULL             -- ENUM: "dine_in", "pickup", "delivery", "service", "retail"
status text NOT NULL DEFAULT "pending"
                                     -- ENUM: "pending", "confirmed", "in_progress",
                                     --       "ready", "completed", "cancelled"
source text NOT NULL DEFAULT "internal"
                                     -- ENUM: "internal", "api"  -- tracks how order was created
external_ref text                    -- reference ID from the external POS system (if source = "api")
table_number text
notes text
subtotal numeric(10,2) NOT NULL DEFAULT 0
discount numeric(10,2) NOT NULL DEFAULT 0
tax numeric(10,2) NOT NULL DEFAULT 0
total numeric(10,2) NOT NULL DEFAULT 0
currency_code char(3) NOT NULL       -- copied from business at time of order
completed_at timestamptz             -- set when status transitions to "completed"; used for reporting
created_by text                      -- user_id or "api_key_id"
created_at timestamptz
updated_at timestamptz
```

### order_lines

```
id uuid PK
order_id uuid FK → orders
variant_id uuid FK → item_variants   -- nullable (for manual/custom lines)
name text NOT NULL                   -- snapshot of item name at time of order
quantity numeric(10,3) NOT NULL
unit_price numeric(10,2) NOT NULL    -- snapshot of price at time of order
line_total numeric(10,2) NOT NULL
notes text
modifiers jsonb                      -- typed as: { name: string, price_adjustment: number }[]
created_at timestamptz
```

On order completion or fulfillment, the system applies consumption profiles for each line item and writes inventory_transactions. This is the core deduction loop.

### order_status_history

```
id uuid PK
order_id uuid FK → orders
from_status text
to_status text NOT NULL
changed_by text
changed_at timestamptz
```

---

### Customers

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL
phone text
email text
notes text
created_at timestamptz
updated_at timestamptz
```

---

### Purchasing & Suppliers

Required for the `purchasing` and `invoice_ai` modules.

### suppliers

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL
contact_name text
phone text
email text
address text
notes text
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

### purchase_orders

```
id uuid PK
business_id uuid FK → businesses
location_id uuid FK → locations      -- receiving location
supplier_id uuid FK → suppliers      -- nullable (unknown supplier from invoice)
status text NOT NULL DEFAULT "draft"
                                     -- ENUM: "draft", "submitted", "received", "cancelled"
source text NOT NULL DEFAULT "manual"
                                     -- ENUM: "manual", "invoice_ai"
invoice_url text                     -- S3 URL of the uploaded invoice document
notes text
expected_at timestamptz
received_at timestamptz
created_by text
created_at timestamptz
updated_at timestamptz
```

### purchase_order_lines

```
id uuid PK
purchase_order_id uuid FK → purchase_orders
variant_id uuid FK → item_variants   -- nullable if AI hasn't matched yet
description text NOT NULL            -- original text from invoice line
quantity numeric(10,3) NOT NULL
unit_id uuid FK → units
unit_cost numeric(10,4) NOT NULL
line_total numeric(10,2) NOT NULL    -- denormalized: quantity * unit_cost; validated on write
matched boolean DEFAULT false        -- has this line been matched to an item_variant?
created_at timestamptz
```

On PO status change to `"received"`, the system creates `inventory_transactions` of type `"receive"` for each matched line, referencing the purchase order.

---

### Invoice AI Flow

**File upload — use S3 presigned URLs, not multipart through the API server:**
1. Frontend calls `POST /api/v1/purchase-orders/upload-url` with `{ filename, contentType }`
2. API server generates an S3 presigned PUT URL (valid 5 minutes) and creates a `purchase_order` record with `status = "draft"`, `source = "invoice_ai"`, `invoice_url` set to the final S3 key
3. Frontend uploads the file directly from the browser to S3 using the presigned URL — the file never passes through the API server
4. Frontend calls `POST /api/v1/purchase-orders/:id/process` to trigger processing

**Processing pipeline:**
5. API server pushes a message to SQS: `{ purchaseOrderId, s3Key, businessId }`
6. A Lambda worker picks up the message; it connects directly to RDS (using its own DB connection string from environment variables — Lambda does NOT call the Express API to avoid circular dependencies and latency)
7. Lambda sends the document to the Claude API with a structured extraction prompt requesting: vendor name, invoice date, line items (description, quantity, unit, unit cost)
8. Claude returns structured JSON; Lambda writes the draft `purchase_order_lines` with `matched = false` initially
9. Lambda runs fuzzy-match logic against the business's `item_variants` catalog and updates lines to `matched = true` where a confident match is found
10. Lambda updates `purchase_order.status = "ai_complete"` — add this status to the ENUM: `"draft"`, `"ai_processing"`, `"ai_complete"`, `"submitted"`, `"received"`, `"cancelled"`
11. Lambda updates `purchase_order.status = "ai_processing"` when it starts (set in step 6 before calling Claude)

**Manager review (in-app, no email required for v1):**
12. The frontend polls the PO status using React Query with `refetchInterval: 3000` while status is `"ai_processing"` — when status changes to `"ai_complete"`, the UI automatically refreshes and shows the review screen
13. Manager reviews extracted lines, corrects any mismatches, links unmatched lines to catalog items or marks them as new items to create
14. Manager confirms → API sets `status = "received"`, `received_at = now()` → inventory transactions are created for all matched lines

The human review step is mandatory before any inventory update. The AI extracts; the human confirms.

---

### Employees

### employee_roles

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL                   -- "Chef", "Cashier", "Technician", "Manager"
hourly_rate_default numeric(10,2)   -- default rate for this role; individual employee rate overrides
created_at timestamptz
```

### employees

```
id uuid PK
business_id uuid FK → businesses
user_id text                         -- nullable; FK → users if employee has app login
name text NOT NULL
email text
phone text
role_id uuid FK → employee_roles
primary_location_id uuid FK → locations  -- nullable; home location for reporting
hourly_rate numeric(10,2)            -- overrides role default
overtime_rate_multiplier numeric(4,2) DEFAULT 1.5
active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
```

`user_id` is nullable: employees who don't have app logins (no clock-in portal access) have `user_id = null`. Employees who sign in to clock in/out have their Clerk user ID here. This links the workforce record to the auth identity.

### employee_locations

```
id uuid PK
employee_id uuid FK → employees
location_id uuid FK → locations
created_at timestamptz

UNIQUE (employee_id, location_id)
```

---

### Time Tracking

The time tracking module replaces traditional payroll. It produces reports that a bookkeeper uses to calculate pay. No tax rates, no payroll calculations.

### time_entries

```
id uuid PK
employee_id uuid FK → employees
location_id uuid FK → locations
shift_id uuid FK → shifts            -- nullable; links to scheduled shift for missed-shift reporting
entry_type text NOT NULL             -- ENUM: "regular", "overtime", "sick", "vacation",
                                     --       "unpaid_leave", "holiday"
clock_in timestamptz NOT NULL
clock_out timestamptz                -- null until clocked out
break_minutes integer DEFAULT 0      -- total break time in minutes
total_minutes integer                -- computed on clock-out: (clock_out - clock_in) - break_minutes
hourly_rate_snapshot numeric(10,2)   -- rate at time of entry (copied from employee record)
overtime_rate_snapshot numeric(4,2)  -- multiplier at time of entry
status text NOT NULL DEFAULT "pending"
                                     -- ENUM: "pending", "approved", "rejected"
approved_by text                     -- user_id of approver
approved_at timestamptz
rejection_reason text
notes text
created_at timestamptz
updated_at timestamptz
```

### time_off_requests

```
id uuid PK
employee_id uuid FK → employees
request_type text NOT NULL           -- ENUM: "vacation", "sick", "personal", "unpaid"
start_date date NOT NULL
end_date date NOT NULL
notes text
status text NOT NULL DEFAULT "pending"
                                     -- ENUM: "pending", "approved", "rejected"
reviewed_by text
reviewed_at timestamptz
rejection_reason text
created_at timestamptz
updated_at timestamptz
```

### Shifts (Scheduling module)

```
id uuid PK
employee_id uuid FK → employees
location_id uuid FK → locations
start_time timestamptz NOT NULL
end_time timestamptz NOT NULL
notes text
created_at timestamptz
```

---

### Custom Fields

```
id uuid PK
business_id uuid FK → businesses
entity_type text NOT NULL            -- "item", "order", "customer", "employee"
name text NOT NULL
field_type text NOT NULL             -- ENUM: "text", "number", "boolean", "date", "select"
options jsonb                        -- for field_type = "select": list of allowed values
required boolean DEFAULT false
sort_order integer DEFAULT 0
active boolean DEFAULT true
created_at timestamptz
```

```
id uuid PK
custom_field_id uuid FK → custom_fields
entity_id uuid NOT NULL              -- ID of the item/order/customer/employee
value text                           -- all values stored as text; cast at application layer
created_at timestamptz
updated_at timestamptz
```

---

### API Keys (api_access module)

Businesses that enable the `api_access` module can generate API keys to allow external POS systems to push orders.

```
id uuid PK
business_id uuid FK → businesses
name text NOT NULL                   -- "Main POS", "Square Integration"
key_hash text NOT NULL               -- bcrypt/argon2 hash of the key; never store plaintext
key_prefix text NOT NULL             -- first 8 chars displayed in UI for identification
location_id uuid FK → locations      -- scope key to a specific location (nullable = all locations)
scopes text[] NOT NULL               -- ["orders:write", "inventory:read"] etc.
active boolean DEFAULT true
last_used_at timestamptz
created_at timestamptz
```

---

## API Architecture

### Authentication

Two authentication paths:

1. **User sessions (Clerk)** — all dashboard and employee portal requests; `Authorization: Bearer <clerk_jwt>`
2. **API keys** — external POS and integration requests; `X-API-Key: <raw_key>`

The API key middleware looks up the key hash, verifies the key, checks `active`, updates `last_used_at`, and injects `businessId` and `locationId` into the request context.

**First sign-in user sync:** When a Clerk JWT is validated and the `user_id` is not found in the local `users` table, create the user record immediately (upsert by Clerk user ID). This happens transparently in the auth middleware before the route handler runs.

**Employee portal user resolution:** When an authenticated user hits any `/api/v1/me/*` route, the middleware must look up `employees` where `user_id = clerkUserId`. If no employee record is found, return `403` — the user has no employee profile for any business. If multiple employee records are found (user works at multiple businesses), require a `X-Business-Id` header to select the active business context. The selected `employeeId` is injected into the request context alongside `businessId`; all `/me/*` routes use `employeeId` for scoping, not `businessId` alone.

### Tenant Scoping

Every authenticated request resolves a `businessId`. Every database query is filtered by `businessId`. A `tenantWhere()` utility enforces this — no query against a business-scoped table may omit this filter.

**Location scoping:** After resolving `businessId`, the middleware calls `getUserLocations(businessUserId)`. If it returns `null`, the user has access to all locations. If it returns an array of location IDs, all queries that filter by `locationId` must restrict to that set. This is enforced in middleware, not in individual route handlers.

### Module Enforcement

A `requireModule(moduleName)` middleware checks `businessModulesTable` before the route handler runs. Disabled module → `403 Forbidden`.

### API Design Principles

- RESTful resource structure: `/api/v1/{resource}/{id}/{sub-resource}`
- All responses are JSON
- Errors return `{ error: string, code?: string }`
- Pagination: cursor-based for large collections
- Versioned: `/api/v1/` prefix on all routes; never break a published contract
- OpenAPI 3.0 spec is the single source of truth; routes are implemented to match the spec; Orval generates client code from the spec

---

## Frontend Architecture

### Two Experiences, One Codebase

**Admin Dashboard** (`/dashboard/*`)
Full management interface for owners and managers. Requires a business user account with role `owner`, `admin`, or `manager`. Renders navigation based on enabled modules only.

**Employee Portal** (`/me/*`)
Lightweight, mobile-friendly interface for employees to:
- Clock in / clock out
- Start and end breaks
- View their schedule
- Submit time-off requests
- View their recent time entries and status

This page must work well on a phone. It does not require the full admin layout. An employee logs in with their own Clerk account. The system links their `user_id` to their `employees` record and scopes all portal actions to their own data.

### Navigation is Module-Driven

The sidebar and all navigation items are rendered from the list of enabled modules for the authenticated business. If `scheduling` is not enabled, the Scheduling link does not appear — it is not just hidden, it is not rendered at all.

### UI Stack

- Tailwind CSS v4 for all styling
- shadcn/ui for component primitives (buttons, dialogs, tables, forms, etc.)
- All components must be accessible (ARIA, keyboard navigation)
- Dark mode support via CSS variables and `ThemeProvider`
- Responsive: admin dashboard is desktop-first; employee portal is mobile-first

---

## Workforce Module — Time Tracking

This module replaces traditional payroll. It does not calculate taxes. It produces accurate records of time worked for a bookkeeper to process.

### Features

- **Clock in / out** with location selection
- **Break tracking** — start break, end break; total break time is deducted from worked hours
- **Entry types** — regular, overtime, sick, vacation, holiday, unpaid leave
- **Overtime rate** — configurable multiplier per employee (default 1.5×); snapshot stored on each time entry
- **Approval workflow** — time entries start as `pending`; managers approve or reject with optional notes
- **Time-off requests** — employees submit requests; managers approve or reject
- **Reports**
  - Hours worked by employee (date range)
  - Hours by type (regular vs overtime vs leave)
  - Approved vs pending entries
  - Missed shifts (scheduled but not clocked in)
  - Exportable to CSV for bookkeeper

### Important Design Notes

- `total_minutes` is computed and stored at clock-out time, not recalculated dynamically
- `hourly_rate_snapshot` and `overtime_rate_snapshot` are copied from the employee record at clock-in — rate changes do not retroactively affect past entries
- Reports show time in minutes; the UI converts to hours and minutes for display
- No currency calculations in this module — the bookkeeper applies rates

---

## Orders and Inventory Deduction

When an order reaches a terminal status (typically `"completed"`), the system automatically applies consumption profiles to deduct inventory.

**Deduction flow:**

1. Order is marked complete
2. For each `order_line`:
   a. Look up the `item_variant`
   b. Find active `consumption_profile` for that variant (variant-specific first, then item-level)
   c. If no profile exists and item type is `"product"`, deduct 1 unit of the variant directly
   d. If a profile exists, iterate `consumption_profile_lines`:
      - For `resource` lines: write `inventory_transaction` (type `"consume"`, negative quantity)
      - For `labor` lines: optionally create a suggested time entry (if `time_tracking` module is enabled)
3. All deductions for an order are written in a single database transaction — all succeed or all fail

This is an internal system operation triggered on status change, not a user-facing API call.

---

## Non-Goals (V1)

These are explicitly out of scope for the initial build. Design for them — do not block them architecturally — but do not implement them yet.

| Feature | Reason |
|---|---|
| Payment processing | Handled by external systems (Square, Stripe, etc.) |
| Tax calculation | Too country/jurisdiction-specific; handled by bookkeeper |
| Payroll calculation | Same — the time tracking module produces the data; external systems calculate pay |
| Multi-currency exchange rates | Each business operates in one currency |
| Native mobile app | PWA-compatible responsive web is sufficient for v1 |
| Delivery platform integrations | Future; architecture supports it via the orders API |
| White-labeling | Future |
| Serial number / lot tracking | Schema has `batch_id` and `expires_at` hooks ready; implement later |

---

## Infrastructure & Configuration

### Required Environment Variables

The API server and Lambda worker both require these variables. Store them in AWS Secrets Manager or ECS task definition secrets — never in code or committed `.env` files.

```
# Database
DATABASE_URL                  # PostgreSQL connection string (RDS)

# Auth
CLERK_SECRET_KEY              # Clerk server-side secret
CLERK_PUBLISHABLE_KEY         # Clerk client-side key (also needed by frontend build)

# AWS
AWS_REGION                    # e.g. "us-east-1"
AWS_S3_BUCKET                 # S3 bucket name for invoice uploads and file storage
AWS_SQS_QUEUE_URL             # SQS queue URL for invoice processing jobs

# AI
ANTHROPIC_API_KEY             # Claude API key for invoice extraction

# App
API_BASE_URL                  # Public URL of the API server (used by Lambda to build S3 presigned URLs)
FRONTEND_URL                  # Public URL of the frontend (used for CORS)
INTERNAL_SERVICE_TOKEN        # Shared secret for any internal service-to-service calls (if needed)
```

### Database Connection Pooling

ECS tasks connect to RDS directly using the `DATABASE_URL`. For production, use **AWS RDS Proxy** in front of RDS to manage connection pooling — this prevents connection exhaustion when multiple ECS tasks are running. The `DATABASE_URL` in production should point to the RDS Proxy endpoint, not the RDS instance directly.

Lambda functions that need DB access (invoice processing worker) also connect via RDS Proxy. Lambda has a cold-start connection overhead — keep Lambda DB interactions focused and fast; do not run complex multi-step transactions from Lambda.

### Custom Fields — Table Names

The two custom fields tables must be explicitly named in the schema:

- `custom_fields` — field definitions per business and entity type
- `custom_field_values` — values per entity instance

---

## Implementation Guidance

### What to Build First (Recommended Order)

1. **Core infrastructure** — database schema, migrations, auth middleware, tenant scoping, module enforcement
2. **Onboarding flow** — business creation wizard, module selection, first location
3. **Items and categories** — the catalog is the foundation everything else references
4. **Inventory** — stock tracking and transactions
5. **Consumption profiles** — resource consumption rules
6. **Orders** — internal order creation + the deduction loop
7. **Purchasing** — suppliers, purchase orders, inventory receive flow
8. **Invoice AI** — SQS/Lambda worker + Claude integration + review UI
9. **Employees and time tracking** — employee records, clock in/out portal, approval workflow
10. **Scheduling** — shifts, conflict detection
11. **Reporting** — sales reports, inventory reports, labor hour reports
12. **API keys** — external POS integration

### Architecture Enforcement Checklist

Before considering any feature complete:

- [ ] All queries against business-scoped tables are filtered by `businessId`
- [ ] Module access is enforced at the route level via `requireModule()` middleware
- [ ] No hardcoded business type assumptions in feature code — behavior is driven by modules only
- [ ] All monetary values use `numeric(10,2)` with `currency_code` on the parent record
- [ ] All timestamps use `timestamptz`
- [ ] Enum-like text fields have a `CHECK` constraint or Drizzle enum — no bare unvalidated text
- [ ] New tables have `created_at` and `updated_at`; primary keys use `uuid().primaryKey().defaultRandom()`
- [ ] New routes are reflected in the OpenAPI spec before client code is generated via Orval
- [ ] Employee portal routes (`/me/*`) are scoped to the authenticated `employeeId`, not just `businessId`
- [ ] Location access enforced via `getUserLocations()` — not hardcoded in route handlers
- [ ] `consumption_profile_lines` inserts validate that the correct columns are non-null for the given `line_type`
- [ ] Invoice AI flow: file goes directly to S3 via presigned URL; Lambda connects to DB directly (not via API)
