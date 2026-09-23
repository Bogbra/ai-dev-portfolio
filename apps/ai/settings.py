from ipaddress import IPv4Network, IPv6Network, ip_network
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    NODE_ENV: str = "development"
    PORT: int = Field(default=4000, ge=1, le=65535)
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    AI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    TAVILY_API_KEY: Optional[str] = None

    # SDK defaults (no timeout, 2 retries) are unsuitable for a single-worker
    # service handling public traffic: a hung upstream call, or a stuck SSE
    # stream, would pin a request indefinitely. Voice gets more headroom —
    # Whisper/TTS calls routinely run longer than a chat completion.
    OPENAI_TIMEOUT_SECONDS: float = Field(default=30.0, gt=0)
    OPENAI_VOICE_TIMEOUT_SECONDS: float = Field(default=45.0, gt=0)
    OPENAI_MAX_RETRIES: int = Field(default=1, ge=0)

    # CS01 — AI Operations Workflow Agent
    MAX_UPLOAD_SIZE_BYTES: int = Field(default=1048576, gt=0)
    MAX_UPLOAD_ROWS: int = Field(default=100, gt=0)
    MAX_REQUEST_LENGTH: int = Field(default=500, gt=0)

    # CS02 — Multi-Agent LinkedIn Post
    MAX_TOPIC_LENGTH: int = Field(default=300, gt=0)

    # CS03 — RAG Research Assistant
    MAX_UPLOAD_MB: int = Field(default=10, gt=0)
    MAX_TOTAL_UPLOAD_MB: int = Field(default=25, gt=0)
    MAX_PDFS: int = Field(default=3, gt=0)
    MAX_CHUNKS: int = Field(default=500, gt=0)
    MAX_QUESTIONS_PER_HOUR: int = Field(default=20, gt=0)

    # Voice Agent
    # VOICE_OPENAI_API_KEY: real OpenAI key for Whisper/TTS (api.openai.com direct).
    # CS01/CS02/CS03 continue using OPENAI_API_KEY + OPENAI_BASE_URL (proxy).
    VOICE_OPENAI_API_KEY: Optional[str] = None
    VOICE_TTS_VOICE: str = "alloy"
    VOICE_MAX_REQUESTS_PER_HOUR: int = Field(default=20, gt=0)
    VOICE_MAX_REQUESTS_PER_DAY: int = Field(default=50, gt=0)

    # SEO Strategy Lab
    SEO_MAX_REQUESTS_PER_HOUR: int = Field(default=10, gt=0)
    SEO_MAX_REQUESTS_PER_DAY: int = Field(default=30, gt=0)

    # MCP server (mcp_server.py) — bare hostnames (no scheme, include the
    # port for local dev) this service itself is reachable at. The MCP SDK's
    # DNS-rebinding protection rejects any request whose Host header isn't
    # in this list, so the deployed hostname (e.g. the Railway domain) must
    # be added here in production or every real MCP client request 421s.
    MCP_ALLOWED_HOSTS: str = "localhost:4000,127.0.0.1:4000"

    # MCP live-demo quota (create_researched_post tool) — deliberately
    # separate from _McpRateLimitMiddleware's generic per-IP protocol rate
    # limit (30/min, covers all /mcp traffic including cheap resource
    # reads). This caps real, provider-billed workflow executions much more
    # tightly; once exhausted, the tool falls back to the deterministic mock.
    # 0 is a valid, meaningful value (live calls always fall back to mock).
    MCP_LIVE_DEMO_ENABLED: bool = True
    MCP_LIVE_CALL_LIMIT: int = Field(default=3, ge=0)
    MCP_LIVE_QUOTA_WINDOW_SECONDS: int = Field(default=86400, gt=0)

    # client_ip.get_client_ip only honors X-Real-IP/X-Forwarded-For from a
    # socket peer inside one of these CIDRs (Railway's edge, as currently
    # observed — not a documented, permanent guarantee; see client_ip.py's
    # module docstring). Configurable rather than hardcoded so a change on
    # Railway's side, or a move to a different host, doesn't require a code
    # change to keep rate-limit keys spoof-resistant.
    TRUSTED_PROXY_CIDRS: str = "100.0.0.0/8"

    @field_validator("TRUSTED_PROXY_CIDRS")
    @classmethod
    def validate_trusted_proxy_cidrs(cls, v: str) -> str:
        # get_trusted_proxy_networks() below used to be the only place this
        # string was ever parsed — lazily, on the first request that needed
        # a client-IP trust decision. A malformed CIDR would then surface as
        # an uncaught ValueError mid-request instead of at boot. Parsing
        # eagerly here, at settings construction, makes a bad value a
        # startup failure instead.
        for part in v.split(","):
            part = part.strip()
            if part:
                ip_network(part)
        return v

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    def get_mcp_allowed_hosts(self) -> list[str]:
        return [h.strip() for h in self.MCP_ALLOWED_HOSTS.split(",")]

    def get_trusted_proxy_networks(self) -> list[IPv4Network | IPv6Network]:
        return [ip_network(c.strip()) for c in self.TRUSTED_PROXY_CIDRS.split(",") if c.strip()]


settings = Settings()
