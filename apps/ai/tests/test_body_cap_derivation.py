"""main.py's per-path body-size caps used to be separately hand-picked byte
counts (e.g. RAG's 40 MB) with no structural link to the settings each
route's own upload-size validation actually enforces (MAX_TOTAL_UPLOAD_MB,
MAX_UPLOAD_SIZE_BYTES, voice.MAX_AUDIO_BYTES) — a later change to one of
those settings wouldn't move the matching middleware cap, silently letting
the two drift apart. _upload_body_cap is the single formula both now go
through.
"""

import main


def test_cap_covers_base64_inflation_of_the_binary_limit():
    # 1 MB binary -> base64 inflates by 4/3 -> the cap must cover at least
    # that much, not just the raw binary size.
    cap = main._upload_body_cap(1024 * 1024)
    assert cap >= 1024 * 1024 * 4 // 3


def test_cap_scales_with_file_count():
    single = main._upload_body_cap(1024 * 1024, file_count=1)
    triple = main._upload_body_cap(1024 * 1024, file_count=3)
    assert triple > single


def test_configured_caps_are_derived_from_the_matching_settings():
    from settings import settings

    expected_cs01 = main._upload_body_cap(settings.MAX_UPLOAD_SIZE_BYTES)
    assert main._CS01_UPLOAD_MAX_BYTES == expected_cs01

    expected_rag = main._upload_body_cap(
        settings.MAX_TOTAL_UPLOAD_MB * 1024 * 1024, file_count=settings.MAX_PDFS
    )
    assert main._RAG_UPLOAD_MAX_BYTES == expected_rag


def test_a_larger_binary_limit_yields_a_larger_cap():
    # The actual regression this closes: if MAX_UPLOAD_SIZE_BYTES were
    # raised, the cap must move with it rather than staying fixed.
    smaller = main._upload_body_cap(1 * 1024 * 1024)
    larger = main._upload_body_cap(2 * 1024 * 1024)
    assert larger > smaller
