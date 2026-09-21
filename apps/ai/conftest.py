# Makes the apps/ai package root importable when pytest is invoked from this directory.

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="session")
def client():
    # Session-scoped and shared across every test file: the MCP mount's
    # StreamableHTTPSessionManager can only have .run() (entered via this
    # app's lifespan) called once per instance for its whole lifetime — a
    # second TestClient(app) context anywhere in the suite would raise
    # "StreamableHTTPSessionManager .run() can only be called once".
    #
    # base_url matches settings.MCP_ALLOWED_HOSTS' default (localhost:4000)
    # rather than TestClient's own default ("testserver") — the MCP SDK's
    # DNS-rebinding protection 421s any request whose Host header isn't on
    # that allowlist, same as it would for a real client hitting an
    # unconfigured hostname.
    with TestClient(app, base_url="http://localhost:4000") as c:
        yield c
