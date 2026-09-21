"""The mock-mode roadmap (no OPENAI_API_KEY) is what a recruiter most likely
sees, and it must obey the same paid-marketing exclusion rule the live
prompt enforces. Regression test for a real instance of this: the English
mock's Phase 3 recommended "Set up retargeting audiences...", which
_quality_issues would flag if it ever ran through the live gate.
"""

import routes.seo as seo


def test_mock_en_roadmap_has_no_paid_marketing():
    result = seo._build_mock("workflow automation", "ops managers", "United States", "leads")
    assert "paid_marketing_in_roadmap" not in seo._quality_issues(result, "United States")


def test_mock_de_roadmap_has_no_paid_marketing():
    result = seo._build_mock("Workflow-Automatisierung", "Betriebsleiter", "Deutschland", "leads")
    assert "paid_marketing_in_roadmap" not in seo._quality_issues(result, "Deutschland")
