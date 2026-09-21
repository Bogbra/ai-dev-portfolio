"""Tests for _normalise_contacts in routes/cs01_workflow.py."""

from routes.cs01_workflow import _normalise_contacts


def _row(**kwargs) -> dict[str, str]:
    return {k: v for k, v in kwargs.items()}


def test_basic_row_produces_contact():
    rows = [_row(name="Jane Doe", email="jane@example.com")]
    contacts = _normalise_contacts(rows)
    assert len(contacts) == 1
    assert contacts[0].name == "Jane Doe"
    assert contacts[0].email == "jane@example.com"


def test_email_is_lowercased():
    rows = [_row(name="Jane Doe", email="Jane.Doe@Example.COM")]
    contacts = _normalise_contacts(rows)
    assert contacts[0].email == "jane.doe@example.com"


def test_row_missing_email_skipped():
    rows = [_row(name="No Email")]
    contacts = _normalise_contacts(rows)
    assert contacts == []


def test_row_with_invalid_email_skipped():
    rows = [_row(name="Bad Email", email="not-an-email")]
    contacts = _normalise_contacts(rows)
    assert contacts == []


def test_row_missing_name_skipped():
    rows = [_row(email="orphan@example.com")]
    contacts = _normalise_contacts(rows)
    assert contacts == []


def test_german_column_names_vorname_nachname():
    rows = [_row(vorname="Hans", nachname="Müller", email="hans@example.de")]
    contacts = _normalise_contacts(rows)
    assert len(contacts) == 1
    assert contacts[0].name == "Hans Müller"


def test_optional_fields_populated():
    rows = [
        _row(
            name="Alice",
            email="alice@corp.com",
            department="Engineering",
            role="Lead",
            company="Acme",
            notes="Key account",
        )
    ]
    contacts = _normalise_contacts(rows)
    c = contacts[0]
    assert c.department == "Engineering"
    assert c.role == "Lead"
    assert c.company == "Acme"
    assert c.notes == "Key account"


def test_optional_fields_absent_when_empty():
    rows = [_row(name="Bob", email="bob@example.com")]
    contacts = _normalise_contacts(rows)
    c = contacts[0]
    assert c.department is None
    assert c.role is None
    assert c.company is None
    assert c.notes is None


def test_multiple_rows_filtered_correctly():
    rows = [
        _row(name="Valid One", email="one@example.com"),
        _row(name="Invalid", email="bad-email"),
        _row(name="Valid Two", email="two@example.com"),
        _row(email="no-name@example.com"),
    ]
    contacts = _normalise_contacts(rows)
    assert len(contacts) == 2
    assert contacts[0].name == "Valid One"
    assert contacts[1].name == "Valid Two"


def test_id_assigned_sequentially():
    rows = [
        _row(name="A", email="a@example.com"),
        _row(name="B", email="b@example.com"),
    ]
    contacts = _normalise_contacts(rows)
    assert contacts[0].id == "1"
    assert contacts[1].id == "2"


def test_long_name_truncated_to_200_not_500():
    # Regression: _sanitise's default max_len must match ParsedContact's
    # name/department/role/company caps (schemas/cs01.py), or constructing
    # ParsedContact raises and /ai-workflow/parse 500s on long input.
    rows = [_row(name="A" * 300, email="long@example.com")]
    contacts = _normalise_contacts(rows)
    assert len(contacts[0].name) == 200


def test_long_notes_truncated_to_1000_not_500():
    rows = [_row(name="Carla", email="carla@example.com", notes="B" * 1500)]
    contacts = _normalise_contacts(rows)
    assert len(contacts[0].notes) == 1000
