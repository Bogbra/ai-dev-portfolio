"""_ChunkRecord.page_number was always hardcoded to None — _extract_pdf_text
joined every page into one blob before chunking, so there was no page to
attribute a chunk to. Chunking now happens per page (_extract_pdf_pages +
the per-page loop in rag_upload), so a citation can point at "page N"
instead of just the filename. These confirm the number that comes back in
/rag/ask actually reflects which page the answered-from chunk came from,
not just that the field exists.
"""

import base64

import routes.cs03_rag as cs03_rag


def test_upload_and_ask_return_correct_page_number(client, monkeypatch):
    monkeypatch.setattr(cs03_rag.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(
        cs03_rag,
        "_extract_pdf_pages",
        lambda _data: [
            (1, "This page discusses the introduction and background material only."),
            (2, "Quarterly revenue grew significantly due to new product launches this year."),
        ],
    )

    upload = client.post(
        "/rag/upload",
        json={
            "files": [
                {
                    "filename": "report.pdf",
                    "content": base64.b64encode(b"%PDF-1.4 fake pdf bytes").decode(),
                    "mimeType": "application/pdf",
                }
            ]
        },
    )
    assert upload.status_code == 200
    session_id = upload.json()["sessionId"]

    ask = client.post(
        "/rag/ask",
        json={"question": "What happened to quarterly revenue this year?", "sessionId": session_id},
    )
    assert ask.status_code == 200
    body = ask.json()
    assert body["status"] == "answer_ready"

    top_source = body["sources"][0]
    assert "revenue" in top_source["text"].lower()
    assert top_source["pageNumber"] == 2
