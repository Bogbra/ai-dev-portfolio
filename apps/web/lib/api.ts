import { env } from '@/lib/env';
import type {
  ContactPayload,
  UploadResponse,
  WorkflowRunRequest,
  WorkflowRunResponse,
  MultiAgentPostRequest,
  MultiAgentPostResult,
  RagUploadRequest,
  RagUploadResult,
  RagAskRequest,
  RagAskResult,
  RetrievedChunk,
  SeoStrategyRequest,
  SeoStrategyResult,
} from '@ai/types';

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
type Result<T> = Ok<T> | Err;

export type RagStreamEvent =
  | { type: 'sources'; sources: RetrievedChunk[]; confidence: string; reasoning: string; mockMode: boolean }
  | { type: 'token'; content: string }
  | { type: 'done' }
  | { type: 'no_context'; message: string }
  | { type: 'error'; message: string };

export async function submitContact(
  payload: ContactPayload,
): Promise<Result<{ message: string; delivered: boolean }>> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as { message?: string; delivered?: boolean };

    if (!res.ok) {
      return { ok: false, error: data.message ?? 'Something went wrong. Please try again.' };
    }

    return {
      ok: true,
      data: { message: data.message ?? 'Message received.', delivered: data.delivered ?? true },
    };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function parseWorkflowUpload(
  file: File,
): Promise<Result<UploadResponse>> {
  try {
    const buffer = await file.arrayBuffer();
    // Spread into String.fromCharCode hits the JS stack limit above ~64 KB.
    // Chunk-encode instead so any file up to the server limit is safe.
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const content = btoa(binary);
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/ai-workflow/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, content, mimeType: file.type }),
    });
    if (res.status === 429) {
      return { ok: false, error: 'temporarily limited' };
    }
    const data = (await res.json()) as UploadResponse & { message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? 'Failed to parse file.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function runMultiAgentPost(
  payload: Omit<MultiAgentPostRequest, '_honey'>,
): Promise<Result<MultiAgentPostResult>> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/multi-agent-post/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, _honey: '' }),
    });
    if (res.status === 429) {
      return { ok: false, error: 'temporarily limited' };
    }
    const data = (await res.json()) as MultiAgentPostResult & { message?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: (data as { message?: string }).message ?? 'Workflow failed. Please try again.',
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function ragUpload(
  payload: RagUploadRequest,
): Promise<Result<RagUploadResult>> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/rag/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) return { ok: false, error: 'temporarily limited' };
    const data = (await res.json()) as RagUploadResult & { message?: string };
    if (!res.ok) return { ok: false, error: (data as { message?: string }).message ?? 'Upload failed.' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function ragAsk(
  payload: Omit<RagAskRequest, '_honey'>,
): Promise<Result<RagAskResult>> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/rag/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, _honey: '' }),
    });
    if (res.status === 429) return { ok: false, error: 'temporarily limited' };
    const data = (await res.json()) as RagAskResult & { message?: string };
    if (!res.ok) return { ok: false, error: (data as { message?: string }).message ?? 'Request failed.' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function ragAskStream(
  payload: Omit<RagAskRequest, '_honey'>,
  onEvent: (event: RagStreamEvent) => void,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/rag/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, _honey: '' }),
      signal: signal ?? null,
    });
    if (res.status === 429) return { ok: false, error: 'temporarily limited' };
    if (!res.ok) {
      const data = (await res.json()) as { message?: string };
      return { ok: false, error: data.message ?? 'Request failed.' };
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              onEvent(JSON.parse(line.slice(6)) as RagStreamEvent);
            } catch { /* ignore malformed event */ }
          }
        }
      }
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { ok: true };
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function runWorkflow(
  payload: Omit<WorkflowRunRequest, '_honey'>,
): Promise<Result<WorkflowRunResponse>> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/ai-workflow/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, _honey: '' }),
    });
    if (res.status === 429) {
      return { ok: false, error: 'temporarily limited' };
    }
    const data = (await res.json()) as WorkflowRunResponse & { message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? 'Workflow failed. Please try again.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

// The backend runs up to 3 sequential OpenAI calls (step1, step2, optional
// correction pass) plus an optional Tavily fetch, each with its own bounded
// 75s timeout and no retries (routes/seo.py's _run_live) — worst case
// around 232s. step2 and the correction pass measured at ~40-42s each
// against the real API, so 75s per call already has real margin; this is
// generous enough not to false-positive on a legitimate slow live run,
// bounded enough that a genuinely stuck request doesn't hang the tab
// indefinitely with no feedback.
const SEO_STRATEGY_TIMEOUT_MS = 240_000;

export async function runSeoStrategy(
  payload: Omit<SeoStrategyRequest, '_honey'>,
): Promise<Result<SeoStrategyResult>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEO_STRATEGY_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/seo-strategy/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, _honey: '' }),
      signal: controller.signal,
    });
    if (res.status === 429) {
      return { ok: false, error: 'temporarily limited' };
    }
    const data = (await res.json()) as SeoStrategyResult & { message?: string };
    if (!res.ok) {
      return { ok: false, error: (data as { message?: string }).message ?? 'Strategy generation failed. Please try again.' };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── MCP — real JSON-RPC calls straight from the browser to /mcp ──────────────
//
// Unlike every other function in this file, this does not go through
// apps/api or a case-study-specific apps/ai route. It talks to the MCP
// server (apps/ai/mcp_server.py) directly, using the modern per-request
// envelope (protocol revision 2026-07-28: params._meta carries the
// protocol version and client capabilities, no prior initialize handshake)
// — the MCP Lab displays the raw request/response for that reason.
//
// This is a single well-formed request, not a full MCP client: there is no
// era negotiation (the real client SDK probes server/discover and falls
// back to the legacy initialize handshake for older servers — see
// mcp.client._probe in the Python SDK), no session/connection lifecycle,
// and no support for any method but tools/call. It demonstrates one real,
// correctly-shaped request/response pair against this specific server, not
// general MCP client behavior.
//
// Safe to call same-origin-adjacent from the browser: the Streamable HTTP
// transport in stateless_http + json_response mode is a plain
// POST-JSON-in/JSON-out endpoint, and apps/ai's CORS allowlist explicitly
// permits the Mcp-Protocol-Version/Mcp-Method/Mcp-Name headers below (see
// main.py) in addition to the safelisted Content-Type/Accept.

let mcpRequestId = 0;

// The only protocol revision this hand-rolled request speaks — the newest
// this portfolio's MCP SDK implements (mcp_types.version.LATEST_MODERN_VERSION
// at the time this was written). A server that has moved on to a newer
// revision would reject this with an UNSUPPORTED_PROTOCOL_VERSION error
// rather than silently misbehaving — there's no negotiation to fall back to.
const MCP_PROTOCOL_VERSION = '2026-07-28';

// create_researched_post runs a multi-step LangGraph workflow (research ->
// write -> critique -> optional revise -> groundedness) against a live
// provider in live mode — several sequential LLM calls, realistically a
// handful of seconds each. Generous enough not to false-positive on a
// legitimate live run, bounded enough that a stuck request doesn't hang
// the tab indefinitely.
const MCP_CALL_TIMEOUT_MS = 45_000;

export type McpJsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
    // Keys are the spec's reverse-DNS _meta namespace
    // (mcp_types.PROTOCOL_VERSION_META_KEY etc. on the Python side) — not
    // arbitrary strings, this is the literal required wire format.
    _meta: {
      'io.modelcontextprotocol/protocolVersion': string;
      'io.modelcontextprotocol/clientCapabilities': Record<string, never>;
      'io.modelcontextprotocol/clientInfo': { name: string; version: string };
    };
  };
};

export type McpToolCall<T> = {
  request: McpJsonRpcRequest;
  response: Record<string, unknown> | null;
  ok: boolean;
  data?: T | undefined;
  error?: string | undefined;
};

export async function callMcpTool<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolCall<T>> {
  mcpRequestId += 1;
  const request: McpJsonRpcRequest = {
    jsonrpc: '2.0',
    id: mcpRequestId,
    method: 'tools/call',
    params: {
      name,
      arguments: args,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': { name: 'portfolio-mcp-lab', version: '1.0.0' },
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_CALL_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.NEXT_PUBLIC_AI_URL}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        // The modern envelope's server-side validation ladder requires
        // these to agree with the body (params._meta's protocol version,
        // the JSON-RPC method, and — for tools/call specifically — the
        // tool name) before it even looks at the body's shape; a mismatch
        // is a clean HEADER_MISMATCH JSON-RPC error, not a silent 200.
        'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION,
        'Mcp-Method': 'tools/call',
        'Mcp-Name': name,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (res.status === 429) {
      return { request, response: null, ok: false, error: 'temporarily limited' };
    }

    const response = (await res.json()) as {
      error?: { message?: string };
      result?: {
        isError?: boolean;
        content?: { text?: string }[];
        structuredContent?: T;
      };
    };

    if (response.error) {
      return {
        request,
        response,
        ok: false,
        error: response.error.message ?? 'MCP request failed.',
      };
    }

    if (response.result?.isError) {
      return {
        request,
        response,
        ok: false,
        error: response.result.content?.[0]?.text ?? 'Tool call failed.',
      };
    }

    return { request, response, ok: true, data: response.result?.structuredContent };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { request, response: null, ok: false, error: 'timeout' };
    }
    return {
      request,
      response: null,
      ok: false,
      error: 'Unable to connect. Please check your connection and try again.',
    };
  } finally {
    clearTimeout(timer);
  }
}
