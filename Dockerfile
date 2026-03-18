# ---- Build stage ----
# syntax=docker/dockerfile:1.7-labs
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Enable corepack (pnpm/yarn if ever needed)
RUN corepack enable || true

# Install dependencies
COPY package.json package-lock.json ./
RUN --network=host npm ci --ignore-scripts

# Generate Prisma client early to allow type-safety during build
COPY prisma ./prisma
RUN --network=host npx prisma generate

# Copy the rest of the app and build
COPY . .
ENV NODE_ENV=production
RUN npm run build && npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Reuse production node_modules from builder to avoid re-downloading Prisma engines
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets and necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Apply migrations at container start, then launch Next.js
CMD sh -c "npx prisma migrate deploy && node node_modules/next/dist/bin/next start -p 3000"


