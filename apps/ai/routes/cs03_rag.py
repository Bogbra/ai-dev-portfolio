"""
CS03 — RAG Research Assistant

Ports the TypeScript rag.ts route to Python.
Endpoints:
  POST /rag/upload  — parse PDFs, create embeddings, store session
  POST /rag/ask     — embed question, retrieve chunks, generate answer
"""

from __future__ import annotations

import asyncio
import base64
import io
import math
import re
import sqlite3
import uuid
from datetime import datetime
from typing import Optional

import sqlite_vec
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter

from client_ip import get_client_ip
from schemas.cs03 import RagAskRequest, RagUploadRequest
from settings import settings

router = APIRouter()
limiter = Limiter(key_func=get_client_ip)

# ─── Session storage ──────────────────────────────────────────────────────────
# Each session gets its own in-memory SQLite database with the sqlite-vec
# extension loaded, using a vec0 virtual table for k-nearest-neighbor search
# over chunk embeddings — real vector-index infrastructure (the same query
# shape a Postgres/pgvector or Chroma-backed RAG pipeline would use), not a
# linear cosine-similarity scan over a Python list. Chunk text/filename/page
# metadata stays in a plain list; the vector index only stores rowid ->
# embedding and is queried by rowid.


class _ChunkRecord:
    __slots__ = ("text", "filename", "page_number")

    def __init__(self, text: str, filename: str, page_number: Optional[int]) -> None:
        self.text = text
        self.filename = filename
        self.page_number = page_number


class _Session:
    # lock + closed guard against the background cleanup sweep (or a
    # concurrent upload's capacity eviction) closing this session's sqlite
    # connection while a /rag/ask(/stream) request already holds a
    # reference to it and is mid-retrieval — see _retrieve_locked and
    # _evict_session, which are the only two places allowed to touch .conn.
    __slots__ = ("chunks", "conn", "created_at", "lock", "closed")

    def __init__(self, chunks: list[_ChunkRecord], conn: Optional[sqlite3.Connection]) -> None:
        self.chunks = chunks
        self.conn = conn
        self.created_at = datetime.now().timestamp()
        self.lock = asyncio.Lock()
        self.closed = False


_sessions: dict[str, _Session] = {}

# Guards the _sessions dict itself (membership, capacity, oldest-selection).
# Defensive, not a fix for an observed failure: today, neither the
# capacity-check-evict-insert sequence below nor _evict_session contains a
# genuine await-suspension point when uncontended, so asyncio never actually
# preempts one call mid-sequence to run another — the dict mutations already
# happen atomically as a side effect of that. This lock makes that atomicity
# a structural guarantee instead of an implicit property of the current
# implementation, so it stays correct if eviction or storage ever gains a
# real async step (e.g. offloaded cleanup, async logging, a slower close).
# Never held while closing a connection — that's synchronized separately via
# each _Session's own .lock (see _close_session) so a slow close can't block
# unrelated capacity operations.
_sessions_lock = asyncio.Lock()


async def _close_session(session: _Session) -> None:
    async with session.lock:
        if not session.closed:
            if session.conn is not None:
                session.conn.close()
            session.closed = True


async def _evict_session(session_id: str) -> None:
    """Remove a session and close its connection safely.

    Pops from _sessions under _sessions_lock, structurally guaranteeing (see
    the comment above _sessions_lock) that two concurrent calls can never
    both select and evict the same "oldest" session — brand-new lookups
    stop finding it right away; a request that already holds a reference
    (fetched before the pop) still synchronizes correctly via the lock +
    closed flag when it reaches _retrieve_locked, instead of hitting a
    closed sqlite connection.
    """
    async with _sessions_lock:
        session = _sessions.pop(session_id, None)
    if session is None:
        return
    await _close_session(session)


# Worst-case memory budget, measured empirically (not estimated): 64 sessions
# x 500 chunks x 1536-dim (text-embedding-3-small) float32 vectors through
# sqlite-vec's vec0 table costs ~5.6 MB/session RSS — roughly double a flat
# array('f') of the same vectors, because vec0 maintains its own shadow
# tables for k-NN search, not just raw storage. 64 sessions would be
# ~360 MB, well past the ~256 MB budget the previous (non-indexed) version
# targeted. _MAX_SESSIONS is lowered to keep the same safety margin:
# 40 sessions x ~5.6 MB ≈ 225 MB worst case.
_MAX_SESSIONS = 40


async def _store_session(session_id: str, session: _Session) -> None:
    # Capacity check, oldest-selection, pop, and insert all happen inside one
    # _sessions_lock critical section (no await in between) — see the
    # comment above _sessions_lock for why this is a structural guarantee
    # rather than a fix for a reproduced failure. The actual connection
    # close for whatever got evicted happens after the lock is released, so
    # it can't block the next caller's capacity check.
    evicted: Optional[_Session] = None
    async with _sessions_lock:
        if len(_sessions) >= _MAX_SESSIONS:
            oldest_id = min(_sessions, key=lambda k: _sessions[k].created_at)
            evicted = _sessions.pop(oldest_id)
        _sessions[session_id] = session
    if evicted is not None:
        await _close_session(evicted)


def _build_vector_index(embeddings: list[list[float]]) -> Optional[sqlite3.Connection]:
    if not embeddings:
        return None

    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)

    dim = len(embeddings[0])
    conn.execute(
        f"CREATE VIRTUAL TABLE chunk_vectors USING vec0(embedding float[{dim}] distance_metric=cosine)"
    )
    conn.executemany(
        "INSERT INTO chunk_vectors(rowid, embedding) VALUES (?, ?)",
        [(i, sqlite_vec.serialize_float32(emb)) for i, emb in enumerate(embeddings)],
    )
    return conn


# ─── Unsafe question patterns ─────────────────────────────────────────────────
# Cheap first-pass heuristic only — trivially bypassable (paraphrase, typo)
# and easy to miss creative phrasings of the same intent. It exists to
# short-circuit obvious cases before spending an OpenAI call. The actual
# safety boundary is the system prompt in rag_ask/rag_ask_stream, which
# constrains the model to answer only from the retrieved source passages —
# do not treat this regex as a security boundary on its own.

_UNSAFE_PATTERNS = [
    re.compile(r"\b(hack|exploit|bypass security)\b", re.I),
    re.compile(r"\b(personal data of|find private info|stalk)\b", re.I),
    re.compile(r"\b(generate malware|write virus)\b", re.I),
]


def _is_unsafe_question(q: str) -> bool:
    return any(p.search(q) for p in _UNSAFE_PATTERNS)


# ─── Citation parsing ──────────────────────────────────────────────────────
# The system prompt tells the model to cite sources by number ([1], [2], ...)
# matching the 1-based [n] context passage numbering built in rag_ask/
# rag_ask_stream. Used to mark usedInAnswer accurately instead of assuming
# the top 3 retrieved passages were the ones actually cited.

_CITATION_RE = re.compile(r"\[(\d+)\]")


def _cited_indices(answer: str, count: int) -> set[int]:
    """0-based indices of sources actually cited via [1], [2], ... in the answer."""
    cited: set[int] = set()
    for m in _CITATION_RE.finditer(answer):
        n = int(m.group(1))
        if 1 <= n <= count:
            cited.add(n - 1)
    return cited


# ─── Text chunking ────────────────────────────────────────────────────────────


def _hard_split(text: str, size: int) -> list[str]:
    return [text[start : start + size] for start in range(0, len(text), size)]


def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    chunks: list[str] = []
    sentences = re.split(r"(?<=[.!?])\s+", text)
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 > chunk_size and current:
            chunks.append(current.strip())
            words = current.split()
            tail_len = max(1, overlap // 6)
            current = " ".join(words[-tail_len:]) + " " + sentence
        else:
            current = (current + " " + sentence).strip() if current else sentence

    if current.strip():
        chunks.append(current.strip())

    if not chunks:
        chunks = _hard_split(text, chunk_size - overlap)

    # A single sentence longer than chunk_size — or text with no [.!?] at
    # all, which collapses the whole input into one "sentence" — never gets
    # split by the loop above: its length check only fires once `current`
    # already holds content, so an oversized sentence still ends up as one
    # oversized chunk. Hard-split anything that slipped through this way
    # instead of silently leaving the target chunk size unenforced.
    final_chunks: list[str] = []
    for chunk in chunks:
        if len(chunk) > chunk_size:
            final_chunks.extend(_hard_split(chunk, chunk_size - overlap))
        else:
            final_chunks.append(chunk)

    return [c for c in final_chunks if len(c.strip()) > 20]


# ─── Mock embedding (keyword hash pseudo-embedding, 64-dim) ──────────────────


def _mock_embed(text: str) -> list[float]:
    vec = [0.0] * 64
    words = re.split(r"\W+", text.lower())
    for word in filter(None, words):
        for i, ch in enumerate(word):
            idx = (ord(ch) * 7 + i * 13) % 64
            vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm > 0 else vec


# ─── PDF text extraction ──────────────────────────────────────────────────────


def _extract_pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = reader.pages[:80]
    return "\n".join(p.extract_text() or "" for p in pages)


# ─── Real embeddings (OpenAI) ─────────────────────────────────────────────────


class EmbeddingValidationError(Exception):
    """A live provider embedding response was malformed — wrong item count
    or inconsistent dimensions across the batch. Callers must treat this as
    a hard failure, not silently substitute mock embeddings: a partial or
    dimension-mismatched batch would corrupt (or crash) the sqlite-vec
    index, which is built once per session from a single fixed dimension.
    """


async def _embed_openai(
    api_key: str, base_url: Optional[str], model: str, texts: list[str]
) -> list[list[float]]:
    from openai_client import make_openai_client

    client = make_openai_client(api_key, base_url)
    res = await client.embeddings.create(model=model, input=texts)
    embeddings = [d.embedding for d in res.data]

    if len(embeddings) != len(texts):
        raise EmbeddingValidationError(
            f"Provider returned {len(embeddings)} embeddings for {len(texts)} inputs."
        )
    dims = {len(e) for e in embeddings}
    if len(dims) > 1:
        raise EmbeddingValidationError(f"Inconsistent embedding dimensions in batch: {dims}.")
    # A consistent dimension of 0 would pass the check above silently — an
    # all-empty-vector batch (`[[], []]`) has exactly one distinct length.
    # sqlite-vec's CREATE VIRTUAL TABLE ... vec0(embedding float[0]) is
    # nonsensical; reject it here with a clear reason instead of letting it
    # fail cryptically in _build_vector_index or produce a degenerate index
    # where cosine similarity is meaningless.
    if dims == {0}:
        raise EmbeddingValidationError("Provider returned zero-dimension (empty) embeddings.")

    return embeddings


# ─── Retrieve top-k chunks ────────────────────────────────────────────────────


def _retrieve(
    session: _Session, query_emb: list[float], top_k: int = 5
) -> list[tuple[_ChunkRecord, float]]:
    k = min(top_k, len(session.chunks))
    if k == 0:
        return []

    rows = session.conn.execute(
        "SELECT rowid, distance FROM chunk_vectors WHERE embedding MATCH ? AND k = ? ORDER BY distance",
        [sqlite_vec.serialize_float32(query_emb), k],
    ).fetchall()

    # vec0's cosine distance is 1 - cosine_similarity, so convert back to the
    # similarity score the rest of this module (and the frontend) expects.
    scored = [(session.chunks[rowid], 1 - distance) for rowid, distance in rows]
    return [(c, s) for c, s in scored if s > 0.1]


async def _retrieve_locked(
    session: _Session, query_emb: list[float], top_k: int = 5
) -> Optional[list[tuple[_ChunkRecord, float]]]:
    """_retrieve, synchronized against _evict_session.

    Returns None if the session was evicted/closed between the caller's
    initial _sessions.get() and this call (e.g. cleanup_sessions swept it
    during the embedding await in between) — the caller should treat that
    the same as "no session found", not let a closed-connection error
    propagate.
    """
    async with session.lock:
        if session.closed:
            return None
        return _retrieve(session, query_emb, top_k)


# ─── POST /rag/upload ─────────────────────────────────────────────────────────


@router.post("/rag/upload")
@limiter.limit("10/hour")
async def rag_upload(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"status": "error", "message": "Invalid JSON."}, status_code=400)

    try:
        req = RagUploadRequest.model_validate(body)
    except Exception:
        return JSONResponse(
            {"status": "error", "message": "Invalid upload request."}, status_code=400
        )

    if len(req.files) > settings.MAX_PDFS:
        return JSONResponse(
            {"status": "error", "message": f"Maximum {settings.MAX_PDFS} PDFs allowed."},
            status_code=400,
        )

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    max_total = settings.MAX_TOTAL_UPLOAD_MB * 1024 * 1024

    all_chunks: list[_ChunkRecord] = []
    all_embeddings: list[list[float]] = []
    total_bytes = 0

    for file in req.files:
        ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""
        if ext != "pdf":
            return JSONResponse(
                {"status": "error", "message": f"{file.filename}: only PDF files are accepted."},
                status_code=400,
            )

        try:
            raw = base64.b64decode(file.content, validate=True)
        except Exception:
            return JSONResponse(
                {"status": "error", "message": "Invalid file encoding."}, status_code=400
            )

        if not raw.startswith(b"%PDF-"):
            return JSONResponse(
                {"status": "error", "message": f"{file.filename} is not a valid PDF file."},
                status_code=400,
            )

        if len(raw) > max_bytes:
            return JSONResponse(
                {
                    "status": "error",
                    "message": f"{file.filename} exceeds the {settings.MAX_UPLOAD_MB} MB limit.",
                },
                status_code=400,
            )

        total_bytes += len(raw)
        if total_bytes > max_total:
            return JSONResponse(
                {
                    "status": "error",
                    "message": f"Total upload size exceeds {settings.MAX_TOTAL_UPLOAD_MB} MB.",
                },
                status_code=400,
            )

        try:
            # pypdf parsing is synchronous CPU work; run it off the event loop
            # so one slow/adversarial PDF can't stall every concurrent request.
            pdf_text = await asyncio.to_thread(_extract_pdf_text, raw)
        except Exception:
            return JSONResponse(
                {
                    "status": "error",
                    "message": f"Could not parse {file.filename}. Please ensure it is a valid PDF.",
                },
                status_code=400,
            )

        if not pdf_text.strip():
            return JSONResponse(
                {
                    "status": "error",
                    "message": f"{file.filename} appears to contain no readable text. Scanned image PDFs are not supported.",
                },
                status_code=400,
            )

        chunks_per_file = settings.MAX_CHUNKS // len(req.files)
        raw_chunks = _chunk_text(pdf_text)[:chunks_per_file]

        use_openai = bool(settings.OPENAI_API_KEY)
        if use_openai:
            try:
                embeddings = await _embed_openai(
                    settings.OPENAI_API_KEY,
                    settings.OPENAI_BASE_URL,
                    settings.EMBEDDING_MODEL,
                    raw_chunks,
                )  # type: ignore[arg-type]
            except Exception:
                return JSONResponse(
                    {
                        "status": "error",
                        "message": "Failed to create embeddings. Please try again.",
                    },
                    status_code=500,
                )
        else:
            embeddings = [_mock_embed(c) for c in raw_chunks]

        # embeddings is guaranteed len(raw_chunks) long here: the mock
        # branch produces exactly one per chunk, and the live branch either
        # matches (validated in _embed_openai) or the request already
        # returned a 500 above — no silent per-chunk mock fallback for a
        # live-mode response that came back short or malformed.
        for i, chunk in enumerate(raw_chunks):
            all_chunks.append(_ChunkRecord(text=chunk, filename=file.filename, page_number=None))
            all_embeddings.append(embeddings[i])

    if not all_chunks:
        return JSONResponse(
            {
                "status": "error",
                "message": "No usable text segments were found in the uploaded document(s).",
            },
            status_code=400,
        )

    # Server-generated, not client-supplied: a client choosing its own ID
    # could target or overwrite another session's ID that it had learned.
    session_id = str(uuid.uuid4())
    vec_conn = _build_vector_index(all_embeddings)
    await _store_session(session_id, _Session(all_chunks, vec_conn))

    use_openai_flag = bool(settings.OPENAI_API_KEY)
    return JSONResponse(
        {
            "status": "indexed",
            "sessionId": session_id,
            "documentCount": len(req.files),
            "chunkCount": len(all_chunks),
            "pipelineSteps": [
                {
                    "name": "Parse PDFs",
                    "status": "done",
                    "detail": f"{len(req.files)} document{'s' if len(req.files) > 1 else ''} extracted",
                },
                {
                    "name": "Split into chunks",
                    "status": "done",
                    "detail": f"{len(all_chunks)} text segments created",
                },
                {
                    "name": "Create embeddings",
                    "status": "done",
                    "detail": "Semantic embeddings generated"
                    if use_openai_flag
                    else "Keyword embeddings (demo mode)",
                },
                {
                    "name": "Build retrieval index",
                    "status": "done",
                    "detail": "Index ready for questions",
                },
            ],
            "mockMode": not use_openai_flag,
        }
    )


# ─── POST /rag/ask ────────────────────────────────────────────────────────────


@router.post("/rag/ask")
@limiter.limit(f"{settings.MAX_QUESTIONS_PER_HOUR}/hour")
async def rag_ask(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"status": "error", "message": "Invalid JSON."}, status_code=400)

    # Honeypot — popped from the raw body before schema validation so the
    # field never reaches application logic and extra="forbid" doesn't
    # reject it as an unknown field. Bots receive a silent success instead
    # of a revealing validation error.
    honey = body.pop("_honey", "") if isinstance(body, dict) else ""

    try:
        req = RagAskRequest.model_validate(body)
    except Exception:
        return JSONResponse(
            {"status": "error", "message": "Invalid request. Please check your input."},
            status_code=400,
        )

    if honey != "":
        return JSONResponse(
            {
                "status": "answer_ready",
                "answer": "Demo response.",
                "reasoning": "",
                "sources": [],
                "confidence": "low",
                "mockMode": True,
            }
        )

    if _is_unsafe_question(req.question):
        return JSONResponse(
            {
                "status": "unsafe_question",
                "message": "This question cannot be processed in the public demo.",
            }
        )

    session = _sessions.get(req.sessionId)
    if not session or not session.chunks:
        return JSONResponse(
            {"status": "error", "message": "No indexed documents found. Please upload PDFs first."},
            status_code=400,
        )

    use_openai = bool(settings.OPENAI_API_KEY)

    # Embed the question
    if use_openai:
        try:
            embs = await _embed_openai(
                settings.OPENAI_API_KEY,
                settings.OPENAI_BASE_URL,
                settings.EMBEDDING_MODEL,
                [req.question],
            )  # type: ignore[arg-type]
            # _embed_openai guarantees exactly one embedding here (one
            # input text) or raises — no silent mock fallback on a live
            # response that came back empty/malformed.
            query_emb = embs[0]
        except Exception:
            return JSONResponse(
                {"status": "error", "message": "Failed to process question. Please try again."},
                status_code=500,
            )
    else:
        query_emb = _mock_embed(req.question)

    top_results = await _retrieve_locked(session, query_emb, 5)

    if top_results is None:
        return JSONResponse(
            {"status": "error", "message": "No indexed documents found. Please upload PDFs first."},
            status_code=400,
        )

    if not top_results:
        return JSONResponse(
            {
                "status": "no_context",
                "message": "No relevant passages found in the uploaded documents for this question.",
            }
        )

    # Generate answer
    if use_openai:
        context = "\n\n".join(
            f"[{i + 1}] {c.filename}: {c.text}" for i, (c, _) in enumerate(top_results)
        )
        try:
            from openai_client import make_openai_client

            client = make_openai_client(settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL)
            completion = await client.chat.completions.create(
                model=settings.AI_MODEL,
                max_tokens=600,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a research assistant. Answer the question using ONLY the provided source passages. If the passages do not contain enough information, say so clearly. Do not invent facts. Keep the answer concise and cite sources by number [1], [2], etc.",
                    },
                    {
                        "role": "user",
                        "content": f"Question: {req.question}\n\nSource passages:\n{context}\n\nProvide a concise, source-grounded answer.",
                    },
                ],
            )
            answer = (
                completion.choices[0].message.content or "Unable to generate an answer."
            ).strip()
            reasoning = "Answer generated from top retrieved passages."
            top_score = top_results[0][1] if top_results else 0
            confidence = "high" if top_score > 0.7 else "medium" if top_score > 0.45 else "low"
        except Exception:
            return JSONResponse(
                {"status": "error", "message": "Answer generation failed. Please try again."},
                status_code=500,
            )
    else:
        top_text = " ".join(c.text[:200] for c, _ in top_results[:2])
        answer = f"Based on the uploaded documents, the most relevant passages discuss: {top_text[:300]}...\n\n[Demo mode — this answer is generated from keyword-matched passages, not a live LLM.]"
        reasoning = (
            f"Retrieved {len(top_results)} passages using keyword similarity. Demo mode active."
        )
        confidence = "low"

    # The full answer is known here (unlike the streaming endpoint below,
    # where sources are sent before the answer exists), so usedInAnswer can
    # reflect which passages the model actually cited — mock mode never
    # cites by number, so it keeps the top-3 approximation.
    cited = _cited_indices(answer, len(top_results)) if use_openai else None
    sources = [
        {
            "text": c.text[:300],
            "filename": c.filename,
            **({"pageNumber": c.page_number} if c.page_number is not None else {}),
            "score": round(score * 100) / 100,
            "usedInAnswer": (i in cited) if cited is not None else (i < 3),
        }
        for i, (c, score) in enumerate(top_results)
    ]

    return JSONResponse(
        {
            "status": "answer_ready",
            "answer": answer,
            "reasoning": reasoning,
            "sources": sources,
            "confidence": confidence,
            "mockMode": not use_openai,
        }
    )


# ─── POST /rag/ask/stream ─────────────────────────────────────────────────────


@router.post("/rag/ask/stream")
@limiter.limit(f"{settings.MAX_QUESTIONS_PER_HOUR}/hour")
async def rag_ask_stream(request: Request):
    import json as _json

    from fastapi.responses import StreamingResponse as _StreamingResponse

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"status": "error", "message": "Invalid JSON."}, status_code=400)

    # Honeypot — popped from the raw body before schema validation so the
    # field never reaches application logic and extra="forbid" doesn't
    # reject it as an unknown field.
    honey = body.pop("_honey", "") if isinstance(body, dict) else ""

    try:
        req = RagAskRequest.model_validate(body)
    except Exception:
        return JSONResponse({"status": "error", "message": "Invalid request."}, status_code=400)

    if honey != "":

        async def _honey_stream():
            yield f"data: {_json.dumps({'type': 'token', 'content': 'Demo response.'})}\n\n"
            yield 'data: {"type": "done"}\n\n'

        return _StreamingResponse(
            _honey_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    if _is_unsafe_question(req.question):

        async def _unsafe():
            yield f"data: {_json.dumps({'type': 'error', 'message': 'This question cannot be processed in the public demo.'})}\n\n"

        return _StreamingResponse(
            _unsafe(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    session = _sessions.get(req.sessionId)
    if not session or not session.chunks:

        async def _no_session():
            yield f"data: {_json.dumps({'type': 'error', 'message': 'No indexed documents found. Please upload PDFs first.'})}\n\n"

        return _StreamingResponse(
            _no_session(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    use_openai = bool(settings.OPENAI_API_KEY)

    if use_openai:
        try:
            embs = await _embed_openai(
                settings.OPENAI_API_KEY,
                settings.OPENAI_BASE_URL,
                settings.EMBEDDING_MODEL,
                [req.question],
            )  # type: ignore[arg-type]
            # _embed_openai guarantees exactly one embedding here (one
            # input text) or raises — no silent mock fallback on a live
            # response that came back empty/malformed.
            query_emb = embs[0]
        except Exception:

            async def _emb_err():
                yield f"data: {_json.dumps({'type': 'error', 'message': 'Failed to process question. Please try again.'})}\n\n"

            return _StreamingResponse(
                _emb_err(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
    else:
        query_emb = _mock_embed(req.question)

    top_results = await _retrieve_locked(session, query_emb, 5)

    if top_results is None:

        async def _session_gone():
            yield f"data: {_json.dumps({'type': 'error', 'message': 'No indexed documents found. Please upload PDFs first.'})}\n\n"

        return _StreamingResponse(
            _session_gone(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    if not top_results:

        async def _no_ctx():
            yield f"data: {_json.dumps({'type': 'no_context', 'message': 'No relevant passages found in the uploaded documents for this question.'})}\n\n"

        return _StreamingResponse(
            _no_ctx(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    top_score = top_results[0][1] if top_results else 0
    confidence = "high" if top_score > 0.7 else "medium" if top_score > 0.45 else "low"
    # Unlike /rag/ask, sources here are sent as the very first SSE event —
    # before the answer has been generated at all — so real citations can't
    # be known yet at this point. Keeps the top-3 approximation rather than
    # restructuring the SSE protocol to patch usedInAnswer in after the
    # stream completes.
    sources = [
        {
            "text": c.text[:300],
            "filename": c.filename,
            **({"pageNumber": c.page_number} if c.page_number is not None else {}),
            "score": round(score * 100) / 100,
            "usedInAnswer": i < 3,
        }
        for i, (c, score) in enumerate(top_results)
    ]

    if use_openai:
        context = "\n\n".join(
            f"[{i + 1}] {c.filename}: {c.text}" for i, (c, _) in enumerate(top_results)
        )

        async def generate():
            # Sources arrive first — UI can render them while answer streams
            yield f"data: {_json.dumps({'type': 'sources', 'sources': sources, 'confidence': confidence, 'reasoning': 'Answer generated from top retrieved passages.', 'mockMode': False})}\n\n"
            try:
                from openai_client import make_openai_client

                client = make_openai_client(settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL)
                stream = await client.chat.completions.create(
                    model=settings.AI_MODEL,
                    max_tokens=600,
                    stream=True,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a research assistant. Answer the question using ONLY the provided source passages. If the passages do not contain enough information, say so clearly. Do not invent facts. Keep the answer concise and cite sources by number [1], [2], etc.",
                        },
                        {
                            "role": "user",
                            "content": f"Question: {req.question}\n\nSource passages:\n{context}\n\nProvide a concise, source-grounded answer.",
                        },
                    ],
                )
                async for chunk in stream:
                    token = chunk.choices[0].delta.content
                    if token:
                        yield f"data: {_json.dumps({'type': 'token', 'content': token})}\n\n"
            except Exception:
                yield f"data: {_json.dumps({'type': 'error', 'message': 'Answer generation failed. Please try again.'})}\n\n"
                return
            yield 'data: {"type": "done"}\n\n'

        return _StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Mock mode — single chunk, no real streaming needed
    top_text = " ".join(c.text[:200] for c, _ in top_results[:2])
    mock_answer = (
        f"Based on the uploaded documents, the most relevant passages discuss: {top_text[:300]}…\n\n"
        "[Demo mode — keyword retrieval active. Set OPENAI_API_KEY for semantic answers.]"
    )

    async def mock_generate():
        yield f"data: {_json.dumps({'type': 'sources', 'sources': sources, 'confidence': 'low', 'reasoning': f'Retrieved {len(top_results)} passages using keyword similarity. Demo mode active.', 'mockMode': True})}\n\n"
        yield f"data: {_json.dumps({'type': 'token', 'content': mock_answer})}\n\n"
        yield 'data: {"type": "done"}\n\n'

    return _StreamingResponse(
        mock_generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Background cleanup coroutine ─────────────────────────────────────────────


async def cleanup_sessions() -> None:
    """Remove sessions older than 2 hours. Called as a background task from lifespan."""
    while True:
        await asyncio.sleep(30 * 60)  # 30-minute sweep interval
        cutoff = datetime.now().timestamp() - 2 * 3600
        for sid in list(_sessions.keys()):
            session = _sessions.get(sid)
            if session is not None and session.created_at < cutoff:
                await _evict_session(sid)
