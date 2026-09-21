"""
Shared AsyncOpenAI client factory.

Every AsyncOpenAI construction in this service goes through here so the
timeout/retry policy lives in one place instead of being repeated (and
potentially drifting) across seven call sites. See settings.py for the
defaults and why the SDK's own (no timeout, 2 retries) aren't safe here.
"""

from __future__ import annotations

from typing import Optional

from openai import AsyncOpenAI

from settings import settings


def make_openai_client(
    api_key: str,
    base_url: Optional[str] = None,
    *,
    voice: bool = False,
    timeout: Optional[float] = None,
    max_retries: Optional[int] = None,
) -> AsyncOpenAI:
    resolved_timeout = (
        timeout
        if timeout is not None
        else (settings.OPENAI_VOICE_TIMEOUT_SECONDS if voice else settings.OPENAI_TIMEOUT_SECONDS)
    )
    return AsyncOpenAI(
        api_key=api_key,
        # "" and None are not equivalent to the SDK: AsyncOpenAI(base_url="")
        # sets base_url to the literal empty string instead of falling back
        # to api.openai.com, and every request then fails with "Request URL
        # is missing an 'http://' or 'https://' protocol." .env.example
        # documents leaving OPENAI_BASE_URL blank to mean "use the default";
        # pydantic-settings parses that blank line as "" (not None), so it
        # has to be normalised here rather than trusted at face value.
        base_url=base_url or None,
        # None (the default) keeps the shared 30s/45s policy; callers whose
        # calls routinely produce much larger completions (e.g. SEO
        # strategy's 3600-4000 max_tokens steps, measured at ~40-42s against
        # the real API — see routes/seo.py) can pass an explicit override
        # rather than hitting the shared timeout on legitimately slow but
        # successful responses.
        timeout=resolved_timeout,
        # None (the default) keeps the shared retry policy; callers with an
        # unusually long sequential-call chain (e.g. SEO strategy's up to 3
        # sequential requests per workflow run) can pass 0 explicitly so a
        # single slow call doesn't silently double the request's total
        # worst-case latency on top of the others.
        max_retries=settings.OPENAI_MAX_RETRIES if max_retries is None else max_retries,
    )
