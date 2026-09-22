"""A PDF page can have extractable text that _chunk_text still reduces to
zero usable chunks (every sentence under its 20-character floor) — rag_upload
used to call _embed_openai with that empty list regardless, on the live
path, making the response depend on how the embedding provider happens to
handle an empty batch rather than on this app's own "no usable text
segments" check. It now skips straight to the next file instead.
"""

import routes.cs03_rag as cs03_rag


def test_embed_openai_is_never_called_for_a_file_with_no_usable_chunks(client, monkeypatch):
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", "sk-test")
    # Text extracts (passes the "no readable text" check) but every
    # resulting chunk is under _chunk_text's 20-character survival floor.
    monkeypatch.setattr(cs03_rag, "_extract_pdf_pages", lambda _data: [(1, "hi. ok. no.")])

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("_embed_openai must not be called when raw_chunks is empty")

    monkeypatch.setattr(cs03_rag, "_embed_openai", _fail_if_called)

    r = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "tooshort.pdf",
                    "content": "JVBERi0xLjQgZmFrZSBwZGYgYnl0ZXM=",  # b"%PDF-1.4 fake pdf bytes"
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert r.status_code == 400
    assert "no usable text" in r.json()["message"].lower()
