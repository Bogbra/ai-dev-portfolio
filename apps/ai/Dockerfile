# ─────────────────────────────────────────────────────────────────────────────
# apps/ai — FastAPI AI backend (Python 3.12 + uv)
# Build context: repo root (Railway default)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# Install uv from its official image. Pinned, not :latest — a moving tag
# means the build silently picks up a different uv version on every rebuild.
COPY --from=ghcr.io/astral-sh/uv:0.10.2 /uv /usr/local/bin/uv

RUN addgroup --system --gid 1001 aiuser \
 && adduser --system --uid 1001 --ingroup aiuser aiuser

WORKDIR /app

# Install Python deps before copying source so this layer is cached separately.
COPY apps/ai/pyproject.toml apps/ai/uv.lock ./
RUN uv sync --frozen --no-dev \
 && chmod -R a+rX /app/.venv

# Copy application source and hand ownership to the non-root user.
COPY --chown=aiuser:aiuser apps/ai/ .

USER aiuser

ENV PORT=4000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 4000

# No --proxy-headers/--forwarded-allow-ips: with "*" uvicorn resolves
# request.client.host to the LEFTMOST X-Forwarded-For entry unconditionally
# (see uvicorn/middleware/proxy_headers.py, _TrustedHosts.always_trust), which
# is the entry a client controls by sending its own header — that made every
# slowapi per-IP limit in this service spoofable. client_ip.get_client_ip()
# resolves the real peer itself (X-Real-IP, then rightmost X-Forwarded-For
# entry) directly from request headers, so uvicorn's own trust mechanism is
# unnecessary here. See client_ip.py for the full investigation.
# JSON-array CMD running `sh -c 'exec ...'`: Railway injects PORT and
# expects the app to bind to it (a hardcoded 4000 ignored that despite the
# ENV PORT=4000 above), so ${PORT:-4000} needs shell expansion — but plain
# shell-form CMD runs uvicorn as a child of /bin/sh, which only forwards
# SIGTERM if it happens to be listening, breaking graceful shutdown. `exec`
# replaces the shell process with uvicorn so it receives signals directly.
CMD ["sh", "-c", "exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port ${PORT:-4000} --timeout-keep-alive 75"]
