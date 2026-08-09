# ─────────────────────────────────────────────────────────────────────────────
# apps/web — Next.js 15 App Router
# Multi-stage build:  deps → builder (extends deps) → runner (standalone)
# Build context: monorepo root  (set in docker-compose.yml)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install workspace deps ──────────────────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

# Copy only the manifests needed to resolve the workspace dependency graph.
# Source changes do not invalidate this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json   ./packages/types/
COPY packages/config/package.json  ./packages/config/
COPY apps/web/package.json         ./apps/web/

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

# Copy workspace package source so pnpm symlinks resolve during the build.
COPY packages ./packages
COPY apps/web ./apps/web

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Pass different values via docker-compose build args for staging / production.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_AI_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AI_URL=$NEXT_PUBLIC_AI_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1536"

RUN pnpm --filter @ai/types build
RUN pnpm --filter @ai/web build

# ── Stage 3: minimal production runner ───────────────────────────────────────
FROM node:22-slim AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

WORKDIR /app

# Because outputFileTracingRoot points to the monorepo root, Next.js places
# the standalone output under apps/web/ inside the standalone directory tree.
# The server entry point is therefore at /app/apps/web/server.js.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
# Static assets must live next to the app's .next directory.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public        ./apps/web/public

USER nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

EXPOSE 3000

WORKDIR /app/apps/web
CMD ["node", "server.js"]
