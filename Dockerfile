# ─── Stage 1: Install & Build ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy only the packages we need
COPY lib/db ./lib/db
COPY artifacts/api-server ./artifacts/api-server

# Install all workspace deps (no lockfile in repo — generate one)
RUN pnpm install --no-frozen-lockfile

# Build shared db lib, then api server
RUN pnpm --filter @bizcore/db build
RUN pnpm --filter @bizcore/api-server build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY lib/db ./lib/db
COPY artifacts/api-server ./artifacts/api-server

# Production install only
RUN pnpm install --no-frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /app/lib/db/dist ./lib/db/dist
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 3001

# Push schema on first run, then start server
CMD ["sh", "-c", "pnpm --filter @bizcore/db db:push && node artifacts/api-server/dist/index.js"]
