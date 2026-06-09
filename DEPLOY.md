# Deploying BizCore to Railway

You need three things before you start:
1. A [Railway account](https://railway.app) (free tier works)
2. A [Clerk account](https://clerk.com) (free tier works) — 5 min setup
3. This repo pushed to GitHub

---

## Step 1 — Clerk Setup (5 min)

1. Go to [clerk.com](https://clerk.com) → Sign up → Create Application
2. Name it "BizCore", enable Email/Password sign-in
3. From the dashboard copy:
   - **Publishable Key** → `pk_test_...`
   - **Secret Key** → `sk_test_...`
4. Under **Allowed redirect URLs** add your Railway web URL (you'll fill this in after deploy, or use `*` temporarily)

---

## Step 2 — Railway Project

1. Go to [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo**
2. Select this repo

This creates your first service (the API server). Railway will auto-detect the root `Dockerfile`.

---

## Step 3 — Add PostgreSQL

Inside your Railway project:
1. Click **+ New** → **Database** → **PostgreSQL**
2. Once it starts, click the database service → **Connect** tab
3. Copy the `DATABASE_URL` value (starts with `postgresql://`)

---

## Step 4 — Configure API Server Environment Variables

Click the API server service → **Variables** tab → add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | paste from step 3 |
| `CLERK_SECRET_KEY` | `sk_test_...` from Clerk |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | your web service URL (add after step 6, use `*` for now) |

Railway will redeploy automatically when you save variables.

---

## Step 5 — Add Web Frontend Service

1. In the same project, click **+ New** → **GitHub Repo** (same repo)
2. Click the new service → **Settings** → set:
   - **Root Directory**: leave blank (we reference the Dockerfile path)
   - **Dockerfile Path**: `artifacts/web/Dockerfile`
3. Go to **Variables** tab → add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | your API service Railway URL (e.g. `https://api-xxx.railway.app`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` from Clerk |

> **Note:** `VITE_*` vars are baked in at Docker build time. After adding them, trigger a redeploy manually (Settings → Deploy → Redeploy).

---

## Step 6 — Wire Up URLs

Once both services are running:
1. Copy your **web service URL** (e.g. `https://web-xxx.railway.app`)
2. Update the API service `FRONTEND_URL` variable to that URL (for CORS)
3. Add the web URL to Clerk's **Allowed redirect URLs**

---

## Step 7 — Verify

Open your web URL → you should see the Clerk sign-in page.
Sign up → onboarding wizard → dashboard.

The first user to sign up will need to complete onboarding (creates the business + first location).

---

## Local Development

```bash
# 1. Install pnpm
npm install -g pnpm

# 2. Copy and fill in env file
cp artifacts/api-server/.env.example .env
# Edit .env: set DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY

# 3. Create web env
echo "VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx" > artifacts/web/.env

# 4. Install + push schema + start
pnpm install
pnpm db:push
pnpm dev
```

App runs at:
- Frontend: http://localhost:5173
- API: http://localhost:3001

---

## Adding AWS (Invoice AI — optional later)

The invoice AI feature requires:
- **S3 bucket** for invoice file storage
- **SQS queue** to trigger processing
- **Lambda function** (`artifacts/lambda-invoice-ai/`) subscribed to the queue

Add these to the API service environment when ready:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
INVOICE_BUCKET=bizcore-invoices-prod
INVOICE_SQS_URL=https://sqs.us-east-1.amazonaws.com/...
```

Everything else (all other modules) works without AWS.
