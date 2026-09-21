"""_parse_xlsx (routes/cs01_workflow.py) used to fully materialise the sheet
via list(ws.iter_rows(...)) before the MAX_UPLOAD_ROWS check ever ran —
MAX_UPLOAD_SIZE_BYTES only bounds the *compressed* upload, not what a small
XLSX can decompress into. It now streams with read_only=True and stops one
row past the limit. These confirm the cap is real and normal files still
parse correctly.
"""

import io

import openpyxl

from routes.cs01_workflow import _parse_xlsx
from settings import settings


def _build_xlsx(row_count: int) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["name", "email"])
    for i in range(row_count):
        ws.append([f"User{i}", f"user{i}@example.com"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_xlsx_normal_file():
    data = _build_xlsx(3)
    rows = _parse_xlsx(data)
    assert len(rows) == 3
    assert rows[0]["name"] == "User0"
    assert rows[0]["email"] == "user0@example.com"


def test_parse_xlsx_stops_one_row_past_the_limit():
    data = _build_xlsx(settings.MAX_UPLOAD_ROWS + 50)
    rows = _parse_xlsx(data)
    assert len(rows) == settings.MAX_UPLOAD_ROWS + 1
