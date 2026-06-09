# ─── Stage 1: Build Vite app ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY artifacts/web ./artifacts/web

RUN pnpm install --no-frozen-lockfile

# VITE_API_URL must be passed as a build arg so Vite bakes it in at build time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN pnpm --filter @bizcore/web build

# ─── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/artifacts/web/dist /usr/share/nginx/html
COPY artifacts/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
