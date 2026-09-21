from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    NODE_ENV: str = "development"
    PORT: int = 4000
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
    OPENAI_TIMEOUT_SECONDS: float = 30.0
    OPENAI_VOICE_TIMEOUT_SECONDS: float = 45.0
    OPENAI_MAX_RETRIES: int = 1

    # CS01 — AI Operations Workflow Agent
    MAX_UPLOAD_SIZE_BYTES: int = 1048576
    MAX_UPLOAD_ROWS: int = 100
    MAX_REQUEST_LENGTH: int = 500

    # CS02 — Multi-Agent LinkedIn Post
    MAX_TOPIC_LENGTH: int = 300

    # CS03 — RAG Research Assistant
    MAX_UPLOAD_MB: int = 10
    MAX_TOTAL_UPLOAD_MB: int = 25
    MAX_PDFS: int = 3
    MAX_CHUNKS: int = 500
    MAX_QUESTIONS_PER_HOUR: int = 20

    # Voice Agent
    # VOICE_OPENAI_API_KEY: real OpenAI key for Whisper/TTS (api.openai.com direct).
    # CS01/CS02/CS03 continue using OPENAI_API_KEY + OPENAI_BASE_URL (proxy).
    VOICE_OPENAI_API_KEY: Optional[str] = None
    VOICE_TTS_VOICE: str = "alloy"
    VOICE_MAX_REQUESTS_PER_HOUR: int = 20
    VOICE_MAX_REQUESTS_PER_DAY: int = 50

    # SEO Strategy Lab
    SEO_MAX_REQUESTS_PER_HOUR: int = 10
    SEO_MAX_REQUESTS_PER_DAY: int = 30

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
    MCP_LIVE_DEMO_ENABLED: bool = True
    MCP_LIVE_CALL_LIMIT: int = 3
    MCP_LIVE_QUOTA_WINDOW_SECONDS: int = 86400

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    def get_mcp_allowed_hosts(self) -> list[str]:
        return [h.strip() for h in self.MCP_ALLOWED_HOSTS.split(",")]


settings = Settings()
