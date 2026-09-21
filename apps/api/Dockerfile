# ─────────────────────────────────────────────────────────────────────────────
# apps/api — Fastify contact backend (Node.js)
# Build context: monorepo root  (set in docker-compose.yml)
#
# Runtime note: the shared packages/types workspace package is compiled to
# packages/types/dist before the runtime image is assembled (stage 2 below)
# and started with plain `node dist/server.js` — no TypeScript source or
# tsx is needed at runtime, only in the build stage.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install workspace deps (incl. devDeps, needed to build) ─────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json   ./packages/types/
COPY packages/config/package.json  ./packages/config/
COPY apps/api/package.json         ./apps/api/

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @ai/types build
RUN pnpm --filter @ai/api build

# ── Stage 3: production-only deps ─────────────────────────────────────────────
# Separate from `deps` so the runtime image doesn't carry tsx/typescript/
# eslint/vitest and everything else only needed to build.
FROM node:22-slim AS deps-prod

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json   ./packages/types/
COPY packages/config/package.json  ./packages/config/
COPY apps/api/package.json         ./apps/api/

RUN pnpm install --frozen-lockfile --prod

# ── Stage 4: production runtime ──────────────────────────────────────────────
FROM deps-prod AS runner

COPY packages ./packages
COPY apps/api ./apps/api
COPY --from=builder /repo/packages/types/dist ./packages/types/dist
COPY --from=builder /repo/apps/api/dist       ./apps/api/dist

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser \
 && chown -R appuser:nodejs /repo/apps/api

USER appuser

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /repo/apps/api

EXPOSE 3001

CMD ["node", "dist/server.js"]
