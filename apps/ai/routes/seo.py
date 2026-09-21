"""
SEO Strategy Lab

Endpoint:
  POST /seo-strategy/run

Multi-step workflow:
  1. Extract business context
  2. Generate keyword candidates + cluster by intent  (Step 1)
  3. Rerank opportunities + content plan              (Step 2)
  4. Quality gate  — optional correction pass in live mode

Scores are AI-assisted prioritization signals, not live search-volume metrics.
"""

from __future__ import annotations

import datetime
import json
import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi import Limiter

from client_ip import get_client_ip
from schemas.seo import CorrectedSeoOutput, SeoStrategyRequest, Step1Output, Step2Output
from settings import settings

router = APIRouter()
limiter = Limiter(key_func=get_client_ip)

# ─── Unsafe patterns ──────────────────────────────────────────────────────────

_UNSAFE = [
    re.compile(r"\b(spam|phish|scam|hack|manipulat)\b", re.I),
    re.compile(r"\b(fake|forged|impersonat)\b", re.I),
    re.compile(r"\b(harass|bully|threaten)\b", re.I),
    re.compile(r"\b(deceptive|misleading|disinformat)\b", re.I),
    re.compile(r"\b(explicit|pornograph|adult content)\b", re.I),
    re.compile(r"\b(casino|gambling|betting|slot)\b", re.I),
]


def _is_unsafe(text: str) -> bool:
    return any(p.search(text) for p in _UNSAFE)


# ─── Market detection ─────────────────────────────────────────────────────────

_GERMAN_KEYWORDS = {
    "germany",
    "german",
    "deutsch",
    "deutschland",
    "de",
    "österreich",
    "austria",
    "schweiz",
    "switzerland",
}

_GERMAN_CHARS = re.compile(r"[äöüÄÖÜß]")


def _is_german_market(market: str) -> bool:
    norm = market.lower().strip()
    return any(kw in norm for kw in _GERMAN_KEYWORDS)


def _has_german_chars(text: str) -> bool:
    return bool(_GERMAN_CHARS.search(text))


# ─── LLM helpers ─────────────────────────────────────────────────────────────


def _jdump(obj: Any) -> str:
    """JSON-serialize without ASCII escaping — preserves ä, ö, ü, ß in prompts."""
    return json.dumps(obj, indent=2, ensure_ascii=False)


def _json_from_response(content: str) -> dict:
    """Parse JSON from model response, stripping markdown fences if present."""
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\n?", "", content)
        content = re.sub(r"\n?```$", "", content)
    try:
        return json.loads(content)
    except Exception:
        return {}


# ─── Prompt builders (language-aware) ────────────────────────────────────────


def _lang_instruction(market: str) -> str:
    if _is_german_market(market):
        return """\
LANGUAGE RULE: The target market is Germany / German-speaking.
Every piece of generated content — keywords, CTAs, content titles, roadmap items,
summaries, descriptions, and explanations — MUST be written in German.
Use correct German spelling including umlauts: ä, ö, ü, Ä, Ö, Ü, ß.
Do NOT use ASCII approximations (ae, oe, ue). Do NOT mix German and English.
All string values in your JSON output must use proper UTF-8 German characters.

ROADMAP PHASE HEADINGS (German):
Phase headings must be fully in German. Use this pattern:
  Phase 1 — Lead-Intent Foundation (Wochen 1–4)
  Phase 2 — Vertrauen und Bewertung (Wochen 5–10)
  Phase 3 — Conversion und organische Skalierung (Wochen 11–16)
Do NOT use English labels like "Authority and Evaluation Content" or "Conversion Scale".

CONTENT FORMAT TERMS (German):
Use "Fallstudie" or "Fallstudien" — never "Case Study" or "Case Studies" in German output.

KEYWORD SCOPE:
Only generate keywords that are directly relevant to the business description provided.
Do NOT add Recruiting, Personalwesen, or HR keywords unless the business explicitly
operates in HR/recruiting. Do NOT add Kundenservice keywords unless the business
explicitly mentions customer service as a core offering.
For general B2B consulting or operations businesses, prefer:
  KI für operative Prozesse, KI-Automatisierung im Backoffice,
  interne Abläufe automatisieren, KI Agenten für Unternehmen,
  KI-Assistenten für interne Prozesse.

GERMAN KEYWORD PHRASING:
Prefer natural, service-intent German search query phrasing. Avoid awkward literal
translations of English phrases. Good examples:
  KI-Automatisierung Beratung, KI-Prozessautomatisierung Beratung,
  KI Prozesse automatisieren lassen, KI-Automatisierung Mittelstand,
  Kosten KI-Automatisierung Beratung, KI Agenten für Unternehmen.
Avoid: overly long compound phrases, vague corporate speak,
keyword-stuffed English fragments embedded in German phrases.
"""
    return "LANGUAGE: Generate all content in the language of the target market."


def _build_step1_system(market: str) -> str:
    return f"""\
You are a senior SEO strategist and content marketing expert.
Your task: analyse a business and generate high-value keyword opportunities.

{_lang_instruction(market)}

IMPORTANT RULES:
- Do NOT generate year-specific terms like "Trends 2023" or "Best Tools 2024".
  Use evergreen phrasing. If a year is needed, use {datetime.date.today().year}.
- Do NOT invent search volumes, CPC, keyword difficulty, or traffic estimates.
- Preserve all special characters exactly as typed.
- Respond with valid JSON only. No markdown fences, no commentary.
"""


def _build_step2_system(market: str) -> str:
    return f"""\
You are a conversion-focused SEO strategist specialising in lead generation.
Your task: rerank keyword opportunities by lead-generation potential, then produce a
concrete content plan and priority roadmap.

{_lang_instruction(market)}

SCORING WEIGHTS for opportunity_score:
  Lead-generation potential   35 %
  Business / service relevance 25 %
  Audience fit                20 %
  Conversion closeness        10 %
  Content gap potential        5 %
  Specificity / long-tail      5 %

PENALIZE these categories (lower scores, rank later):
- Broad generic informational keywords with no clear service-demand signal
- Vague "best tools" listicles that are not tied to a consulting/service conversion path
- Year-specific trend terms (e.g., "KI Trends 2023")
- Queries that are purely educational with no purchasing or consulting intent

REQUIREMENTS FOR EVERY TOP OPPORTUNITY:
- cta_angle: must be concrete, specific, and lead-oriented.
  Good (German): "Kostenlosen KI-Automatisierungs-Check anfragen"
                 "Workflow-Potenzial analysieren lassen"
                 "Beratungsgespräch zur KI-Automatisierung buchen"
                 "KI-Workflow-Audit starten"
  Good (English): "Book a free AI workflow strategy call"
                  "Get a custom automation scope assessment"
  Bad: "Learn more" / "Discover the top tools" / "Jetzt individuelle Beratung anfragen"
- why_ranked_here: must mention (a) audience fit, (b) conversion / buying intent,
  (c) lead-generation value, (d) recommended content format and CTA reasoning.
  Write 2–3 sentences. Be specific to this business and this keyword.

ROADMAP RULES:
- The roadmap must contain ONLY organic SEO and content conversion actions.
- Do NOT include: retargeting, paid ads, Google Ads, Facebook Ads, performance marketing,
  bezahlte Kampagnen, Retargeting-Kampagnen, or any paid media.
- Allowed roadmap actions: landing pages, content articles, guides, case studies,
  FAQ sections, internal linking, lead magnets, CTA optimisation on organic pages,
  topic cluster expansion, on-page optimisation, email follow-ups for organic leads.

IMPORTANT RULES:
- Do NOT invent search volumes, CPC, keyword difficulty, or traffic estimates.
- Do NOT generate year-specific terms.
- Every roadmap item must be specific to the identified opportunities — not generic SEO advice.
- Preserve all special characters: ä, ö, ü, Ä, Ö, Ü, ß.
- Respond with valid JSON only. No markdown fences, no commentary.
"""


# ─── Step 1 schema ───────────────────────────────────────────────────────────

_STEP1_SCHEMA = {
    "extracted_business_context": {
        "business_type": "string — service / consulting / SaaS / agency / product / etc.",
        "core_service": "string — single-line description of the primary offering",
        "target_audience": "string — who the ideal customer is",
        "value_proposition": "string — what sets this business apart",
        "pain_points": ["string — customer problem this business solves (3–5 items)"],
        "competitive_differentiators": ["string — what makes this stand out (2–4 items)"],
    },
    "keyword_candidates": [
        {
            "term": "string — keyword or search phrase (in market language; use correct umlauts)",
            "type": "one of: seed | long-tail | question | comparison | implementation",
            "intent": "one of: informational | commercial_investigation | comparison | implementation | local_service | lead_generation",
        }
    ],
    "intent_clusters": [
        {
            "intent": "string — intent category label",
            "description": "string — why searchers use this intent (in market language)",
            "terms": ["string — keyword terms in this cluster"],
            "business_relevance": "one of: high | medium | low",
        }
    ],
    "summary": "string — 2–3 sentence summary of the SEO opportunity landscape (in market language)",
}


async def _step1_extract_and_generate(
    client: Any,
    topic: str,
    audience: str,
    market: str,
    goal: str,
    url: str,
    web_context: str,
) -> dict:
    goal_context = {
        "traffic": "prioritise broad informational and long-tail content that drives organic traffic",
        "leads": "prioritise service-demand, consulting-intent, and lead-generation queries — queries where the searcher wants help doing something, not just reading about it",
        "content": "prioritise content-gap opportunities where in-depth educational content can own a niche",
        "visibility": "prioritise local/service queries and branded searches for awareness",
    }.get(goal, "balance traffic, lead value, and content opportunity")

    url_line = f"Website URL (for context only, do not visit): {url}" if url else ""
    web_line = (
        f"\nWeb context about this topic (use for context, not as keywords):\n{web_context}"
        if web_context
        else ""
    )
    is_german = _is_german_market(market)

    prompt = f"""\
Business/service description: {topic}
Target audience: {audience or "not specified"}
Market / language: {market}
SEO goal: {goal} — {goal_context}
{url_line}{web_line}

{"REMINDER: Generate ALL keyword terms in German with correct umlauts (ä, ö, ü, ß)." if is_german else ""}

Generate:
1. extracted_business_context — analyse the business, audience, and value proposition
2. keyword_candidates — 20–30 keyword opportunities in the language of the {market} market.
   Include: seed keywords, long-tail terms, search questions (Wie / Was / Welche / How / What / Which),
   comparison terms, implementation queries, and direct service/consultant-intent queries.
   PRIORITISE queries that show service demand, consulting intent, or implementation intent.
   AVOID generic "best tools" terms and year-specific terms like "Trends 2023".
3. intent_clusters — group candidates by search intent
4. summary — 2–3 sentences summarising the SEO opportunity landscape

Follow this JSON schema exactly (all string values in market language with correct characters):
{_jdump(_STEP1_SCHEMA)}
"""

    response = await client.chat.completions.create(
        model=settings.AI_MODEL,
        messages=[
            {"role": "system", "content": _build_step1_system(market)},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=2800,
        response_format={"type": "json_object"},
    )
    raw = _json_from_response(response.choices[0].message.content or "")
    # response_format=json_object only guarantees valid JSON syntax, not any
    # particular shape — unlike CS01/CS02's strict:true tool-calling, this
    # validation is the only structural check on this response, not a
    # second one on top of an API-level guarantee. Step1Output is
    # deliberately lenient (schemas/seo.py) so it only rejects genuinely
    # malformed output, not minor prose-vs-actual drift.
    try:
        return Step1Output.model_validate(raw).model_dump()
    except ValidationError:
        return {}


# ─── Step 2 schema ───────────────────────────────────────────────────────────

_STEP2_SCHEMA = {
    "reranked_opportunities": [
        {
            "rank": "integer 1–10",
            "term": "string — keyword or search phrase (in market language, correct umlauts)",
            "intent": "string — intent type",
            "opportunity_score": "integer 0–100 — weighted AI-assisted priority score (lead 35% + business 25% + audience 20% + conversion 10% + gap 5% + specificity 5%)",
            "lead_relevance": "one of: high | medium | low",
            "business_relevance": "one of: high | medium | low",
            "intent_fit": "one of: strong | moderate | weak",
            "content_gap_potential": "one of: high | medium | low",
            "conversion_closeness": "one of: high | medium | low",
            "suggested_content_format": "string — specific format in market language (e.g. Landing Page, Ratgeber, Vergleichsartikel, Case Study, FAQ)",
            "cta_angle": "string — concrete lead-oriented CTA in market language (e.g. 'Kostenlosen KI-Check anfragen' not 'Learn more')",
            "why_ranked_here": "string — 2–3 sentences covering: (a) why this query matches the target audience, (b) conversion/buying intent signal, (c) lead-generation value and recommended content approach",
        }
    ],
    "content_ideas": [
        {
            "title": "string — specific content title in market language (not generic)",
            "format": "one of: Landing Page | Ratgeber | Vergleichsartikel | FAQ | Case Study | Checkliste | Tutorial | guide | comparison article | checklist",
            "target_terms": ["string — keyword terms this content targets"],
            "rationale": "string — why this specific content supports the SEO and lead-generation goal",
        }
    ],
    "lead_generation_angles": [
        {
            "angle": "string — lead-gen content or offer angle (specific to the business, in market language)",
            "cta": "string — concrete CTA text in market language",
            "target_terms": ["string — keyword terms that drive this lead path"],
            "rationale": "string — why this angle converts searchers into leads for this specific business",
        }
    ],
    "roadmap": [
        {
            "phase": "string — phase name in market language (e.g. 'Phase 1 — Lead-Intent Foundation (Wochen 1–4)')",
            "focus": "string — specific strategic focus for this phase (not generic SEO advice)",
            "items": [
                "string — specific action item tied to identified opportunities (in market language)"
            ],
            "rationale": "string — why this phase comes first or second or third (specific to this business)",
        }
    ],
}


async def _step2_rerank_and_plan(
    client: Any,
    topic: str,
    goal: str,
    market: str,
    context: dict,
    candidates: list,
    clusters: list,
) -> dict:
    goal_priority = {
        "traffic": "Prioritise terms with high content-gap potential and informational intent that drive volume.",
        "leads": (
            "STRONG PRIORITY: Queries showing service demand, consulting intent, implementation intent, "
            "cost/pricing intent, and direct hire/contact intent. "
            "Penalise broad informational queries and generic tool lists. "
            "A keyword ranking #1 must clearly connect to a consulting or service conversion path."
        ),
        "content": "Prioritise terms where in-depth, expert educational content can own a niche with low competition.",
        "visibility": "Prioritise branded, local, and service-discovery terms for market awareness.",
    }.get(goal, "Balance traffic, lead value, and content opportunity.")

    is_german = _is_german_market(market)
    lang_reminder = (
        "REMINDER: ALL output (terms, CTAs, content titles, roadmap items, explanations) must be in German with correct umlauts."
        if is_german
        else ""
    )

    prompt = f"""\
Business context:
{_jdump(context)}

SEO goal: {goal}
Market: {market}
Ranking priority: {goal_priority}
{lang_reminder}

Keyword candidates ({len(candidates)} total):
{_jdump(candidates)}

Intent clusters:
{_jdump(clusters)}

Tasks:
1. reranked_opportunities — select the TOP 8–10 opportunities ranked by the weighted scoring:
   Lead-generation potential 35% · Business relevance 25% · Audience fit 20% ·
   Conversion closeness 10% · Content gap 5% · Specificity 5%.

   For EACH opportunity:
   - opportunity_score: apply the weights, produce integer 0–100
   - cta_angle: must be SPECIFIC and LEAD-ORIENTED (not "Learn more", not "Discover the top tools")
   - why_ranked_here: 2–3 sentences covering audience fit, buying/service intent, and
     lead-generation value. Reference the SPECIFIC business and audience.

2. content_ideas — 5–7 specific content pieces tied to the top opportunities.
   Titles must be specific to this business, not generic templates.

3. lead_generation_angles — 3–5 high-value lead-gen angles with concrete CTAs.
   Each angle must be specific to this business.

4. roadmap — 3-phase roadmap specific to the identified opportunities.
   Phase 1: lead-intent foundation (service landing pages, cost/pricing pages, hire-intent pages).
   Phase 2: authority and evaluation content (comparison articles, guides, case studies, FAQ sections).
   Phase 3: conversion and organic scale (lead magnets on organic pages, internal linking,
            CTA optimisation, topic cluster expansion, email follow-ups for organic leads).
   Items must reference actual identified opportunities — not generic SEO tasks.
   IMPORTANT: Do NOT include retargeting, paid ads, or any paid media actions in the roadmap.

Follow this JSON schema exactly:
{_jdump(_STEP2_SCHEMA)}
"""

    response = await client.chat.completions.create(
        model=settings.AI_MODEL,
        messages=[
            {"role": "system", "content": _build_step2_system(market)},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=3600,
        response_format={"type": "json_object"},
    )
    raw = _json_from_response(response.choices[0].message.content or "")
    try:
        return Step2Output.model_validate(raw).model_dump()
    except ValidationError:
        return {}


# ─── Quality gate ─────────────────────────────────────────────────────────────

_OLD_YEAR_RE = re.compile(r"\b20(1\d|2[0-" + str(datetime.date.today().year - 1)[-1] + r"])\b")
_FAKE_METRIC_RE = re.compile(
    r"\b(search volume|keyword difficulty|kd score|cpc|cost per click|domain authority|da \d|traffic estimate)\b",
    re.I,
)
_GENERIC_CTA_RE = re.compile(
    r"\b(learn more|read more|click here|discover the|find out|see more|get started)\b",
    re.I,
)
_PAID_MARKETING_RE = re.compile(
    r"\b(retargeting|paid ads?|google ads?|facebook ads?|ppc|performance.?marketing"
    r"|bezahlte? (anzeigen?|kampagnen?)|retargeting.?kampagnen?|paid media)\b",
    re.I,
)


def _quality_issues(result: dict, market: str) -> list[str]:
    """Return list of quality problem codes. Empty = pass."""
    issues: list[str] = []
    flat = json.dumps(result, ensure_ascii=False).lower()

    # Outdated year terms
    if _OLD_YEAR_RE.search(flat):
        issues.append("outdated_year_terms")

    # Fake SEO metrics
    if _FAKE_METRIC_RE.search(flat):
        issues.append("fake_metrics")

    # Generic CTAs
    if _GENERIC_CTA_RE.search(flat):
        issues.append("generic_cta")

    # German market: check that top keyword terms have German characters
    if _is_german_market(market):
        opps = result.get("reranked_opportunities", [])
        if opps:
            german_count = sum(
                1
                for o in opps[:6]
                if _has_german_chars(o.get("term", "") + o.get("why_ranked_here", ""))
            )
            if german_count < 2:
                issues.append("missing_german_content")

    # Paid marketing in roadmap (organic SEO lab only)
    roadmap_text = json.dumps(result.get("roadmap", []), ensure_ascii=False).lower()
    if _PAID_MARKETING_RE.search(roadmap_text):
        issues.append("paid_marketing_in_roadmap")

    # Missing or very short why_ranked_here
    for opp in result.get("reranked_opportunities", [])[:5]:
        why = opp.get("why_ranked_here", "")
        if len(why) < 60:
            issues.append("thin_explanations")
            break

    return issues


# ─── Correction pass ──────────────────────────────────────────────────────────

_CORRECTION_SYSTEM = """\
You are a senior SEO editor fixing quality issues in an AI-generated SEO strategy.
Respond with valid JSON only. No markdown fences. Preserve all UTF-8 characters exactly.
"""


async def _correction_pass(
    client: Any,
    result: dict,
    issues: list[str],
    market: str,
    goal: str,
) -> dict:
    """One focused correction call to fix detected quality issues."""
    is_german = _is_german_market(market)
    issue_notes = []
    if "outdated_year_terms" in issues:
        issue_notes.append(
            "Remove all year-specific terms (e.g. 2023, 2024). Replace with evergreen phrasing."
        )
    if "fake_metrics" in issues:
        issue_notes.append(
            "Remove any search volumes, CPC, keyword difficulty, DA scores, or traffic estimates."
        )
    if "generic_cta" in issues:
        issue_notes.append(
            "Replace generic CTAs ('Learn more', 'Discover') with concrete lead-oriented CTAs "
            + (
                "in German (e.g. 'Kostenlosen KI-Check anfragen', 'Beratungsgespräch buchen')."
                if is_german
                else "(e.g. 'Book a free strategy call', 'Request a custom quote')."
            )
        )
    if "missing_german_content" in issues:
        issue_notes.append(
            "The target market is Germany. Translate ALL keywords, CTAs, content titles, roadmap items, "
            "and explanations into German with correct umlauts: ä, ö, ü, Ä, Ö, Ü, ß."
        )
    if "paid_marketing_in_roadmap" in issues:
        issue_notes.append(
            "Remove ALL paid marketing actions from the roadmap (retargeting, paid ads, Google Ads, "
            "performance marketing, bezahlte Kampagnen, Retargeting-Kampagnen). "
            "Replace with organic SEO actions: internal linking, lead magnets on organic pages, "
            "CTA optimisation, topic cluster expansion, or email follow-ups for organic leads."
        )
    if "thin_explanations" in issues:
        issue_notes.append(
            "Expand every 'why_ranked_here' to 2–3 sentences covering: "
            "(a) audience fit, (b) conversion/service intent signal, (c) lead-generation value."
        )

    corrections = "\n".join(f"- {n}" for n in issue_notes)

    prompt = f"""\
Fix the following quality issues in this SEO strategy JSON:

Issues to fix:
{corrections}

Current SEO strategy (fix in place, keep the same JSON structure):
{_jdump(result)}

Return the COMPLETE corrected JSON with the same top-level keys.
Do NOT add or remove keys. Only fix the content of string values.
"""

    response = await client.chat.completions.create(
        model=settings.AI_MODEL,
        messages=[
            {"role": "system", "content": _CORRECTION_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )
    corrected = _json_from_response(response.choices[0].message.content or "")
    if not corrected or not corrected.get("reranked_opportunities"):
        return result
    # Merge onto the pre-correction result before validating, not after
    # replacing it outright: every Step1Output/Step2Output field defaults
    # to empty, so a correction response that omits a top-level key (the
    # prompt asks the model to echo all of them back, but that's not
    # enforced — response_format=json_object gives no schema guarantee)
    # would otherwise validate cleanly and silently wipe that field with
    # its default — e.g. a correction that only touches reranked_opportunities
    # would erase summary/keyword_candidates/intent_clusters from the
    # final response, valid-looking the whole way. Merging first means a
    # missing key falls back to its original value, not an empty default.
    candidate = {**result, **corrected}
    try:
        return CorrectedSeoOutput.model_validate(candidate).model_dump()
    except ValidationError:
        return result


# ─── Optional Tavily web context ──────────────────────────────────────────────


async def _fetch_web_context(topic: str, market: str) -> str:
    """Lightweight topic context via Tavily — returns empty string on any failure."""
    if not settings.TAVILY_API_KEY:
        return ""
    try:
        import httpx

        query = topic if not _is_german_market(market) else f"{topic} site:.de"
        async with httpx.AsyncClient(timeout=7.0) as http:
            resp = await http.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 3,
                },
            )
            data = resp.json()
            snippets = [r.get("content", "") for r in data.get("results", []) if r.get("content")]
            return " ".join(snippets[:3])[:900]
    except Exception:
        return ""


# ─── Live workflow ────────────────────────────────────────────────────────────


async def _run_live(
    topic: str,
    audience: str,
    market: str,
    goal: str,
    url: str,
) -> dict:
    from openai_client import make_openai_client

    # step2 (reranking + content plan, max_tokens=3600) and the optional
    # correction pass (max_tokens=4000) measured at ~40-42s each against the
    # real API — comfortably over the shared 30s default, which was cutting
    # off legitimately-completing calls, not just genuinely stuck ones (this
    # is what "hangs on Reranking, then errors out" actually was). 75s
    # leaves real margin above that. Retries are disabled rather than kept:
    # with a timeout this size, a silent retry-on-timeout would let a single
    # borderline call cost 150s on its own — better to fail once, fast, and
    # let the (now clearly labeled) client-side error be retried manually.
    client = make_openai_client(
        settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL, timeout=75.0, max_retries=0
    )

    web_context = await _fetch_web_context(topic, market)
    used_web_context = bool(web_context)

    step1 = await _step1_extract_and_generate(
        client, topic, audience, market, goal, url, web_context
    )
    step2 = await _step2_rerank_and_plan(
        client,
        topic,
        goal,
        market,
        step1.get("extracted_business_context") or {},
        step1.get("keyword_candidates") or [],
        step1.get("intent_clusters") or [],
    )

    result: dict = {
        "mode": "live",
        "summary": step1.get("summary", ""),
        "extracted_business_context": step1.get("extracted_business_context") or {},
        "keyword_candidates": step1.get("keyword_candidates") or [],
        "intent_clusters": step1.get("intent_clusters") or [],
        "reranked_opportunities": step2.get("reranked_opportunities") or [],
        "content_ideas": step2.get("content_ideas") or [],
        "lead_generation_angles": step2.get("lead_generation_angles") or [],
        "roadmap": step2.get("roadmap") or [],
        "warnings": [],
        "metadata": {
            "model": settings.AI_MODEL,
            "used_web_context": used_web_context,
            "market": market,
            "goal": goal,
            "disclaimer": "Scores are AI-assisted prioritization signals, not live search-volume metrics.",
        },
    }

    # Quality gate — one correction pass if issues found, then re-validate.
    # A correction that didn't actually fix everything (or a correction
    # call that failed outright) used to be indistinguishable from a clean
    # pass — the original, still-flawed result was returned silently with
    # warnings always empty. Whatever issue codes survive (or the original
    # ones, if the correction call itself raised) are now reported in
    # result["warnings"] instead of being hidden.
    issues = _quality_issues(result, market)
    if issues:
        try:
            corrected = await _correction_pass(client, result, issues, market, goal)
            corrected["mode"] = "live"
            corrected.setdefault("metadata", result["metadata"])
            result = corrected
            remaining_issues = _quality_issues(result, market)
        except Exception:
            # Correction call itself failed — the original issues are
            # still present, unaddressed.
            remaining_issues = issues
        result["warnings"] = remaining_issues

    return result


# ─── Mock result (market-aware) ───────────────────────────────────────────────


def _build_mock(topic: str, audience: str, market: str, goal: str) -> dict:
    is_german = _is_german_market(market)

    if is_german:
        return _build_mock_de(topic, audience, market, goal)

    return _build_mock_en(topic, audience, goal)


def _build_mock_de(topic: str, audience: str, market: str, goal: str) -> dict:
    t = topic[:60]
    aud = audience or "Entscheidungsträger"
    return {
        "mode": "mock",
        "summary": (
            f"Das SEO-Potenzial für '{t}' konzentriert sich stark auf Suchanfragen mit "
            f"direkter Beratungs- und Umsetzungsabsicht. {aud} suchen nicht primär nach "
            f"Informationen — sie suchen nach konkreter Unterstützung. "
            f"Ein 3-phasiger Aufbau, der mit Service-Landing-Pages für hohe Conversion-Nähe "
            f"startet, bietet den schnellsten Weg zu qualifizierten Leads."
        ),
        "extracted_business_context": {
            "business_type": "Beratung / Dienstleistung",
            "core_service": t,
            "target_audience": aud,
            "value_proposition": f"Fundiertes Praxis-Know-how bei {t} — schneller Einstieg, nachhaltige Ergebnisse",
            "pain_points": [
                "Unklare Entscheidungsgrundlage ohne eigenes Fachwissen",
                "Zu langer Umsetzungshorizont ohne externe Unterstützung",
                "Ungewissheit über den tatsächlichen ROI vor dem ersten Schritt",
                "Fragmentierte Tools ohne klare Integration",
                "Interner Ressourcenmangel für die Einführung",
            ],
            "competitive_differentiators": [
                "Tiefes Domänenwissen mit Praxiserfahrung",
                "Transparenter Prozess mit klaren Meilensteinen",
                "Produktionsreife Umsetzung statt reiner Beratung",
            ],
        },
        "keyword_candidates": [
            {"term": f"Beratung zur {t}", "type": "seed", "intent": "lead_generation"},
            {
                "term": f"Kosten {t} Beratung",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
            {"term": f"{t} beauftragen", "type": "long-tail", "intent": "lead_generation"},
            {"term": f"{t} Agentur", "type": "seed", "intent": "lead_generation"},
            {"term": f"{t} für {aud}", "type": "long-tail", "intent": "commercial_investigation"},
            {"term": f"{t} Mittelstand", "type": "long-tail", "intent": "commercial_investigation"},
            {"term": f"Was ist {t}", "type": "question", "intent": "informational"},
            {
                "term": f"{t} Prozesse optimieren",
                "type": "implementation",
                "intent": "implementation",
            },
            {"term": f"{t} einführen lassen", "type": "long-tail", "intent": "lead_generation"},
            {
                "term": f"Praxisbeispiele {t} Unternehmen",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
            {"term": f"{t} vs. manuelle Prozesse", "type": "comparison", "intent": "comparison"},
            {"term": f"{t} Anbieter Vergleich", "type": "comparison", "intent": "comparison"},
            {
                "term": f"{t} ROI Praxisbeispiele",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
            {
                "term": f"{t} Einführung Schritt für Schritt",
                "type": "long-tail",
                "intent": "implementation",
            },
            {"term": f"{t} Experten Unternehmen", "type": "seed", "intent": "lead_generation"},
        ],
        "intent_clusters": [
            {
                "intent": "lead_generation",
                "description": "Suchanfragen mit direkter Dienstleistungs- oder Beratungsabsicht",
                "terms": [
                    f"Beratung zur {t}",
                    f"{t} beauftragen",
                    f"{t} einführen lassen",
                    f"{t} Agentur",
                    f"{t} Experten Unternehmen",
                ],
                "business_relevance": "high",
            },
            {
                "intent": "commercial_investigation",
                "description": "Kaufbereite Interessenten, die Optionen vergleichen und Kosten prüfen",
                "terms": [
                    f"Kosten {t} Beratung",
                    f"{t} für {aud}",
                    f"{t} Mittelstand",
                    f"Praxisbeispiele {t} Unternehmen",
                    f"{t} ROI Praxisbeispiele",
                ],
                "business_relevance": "high",
            },
            {
                "intent": "implementation",
                "description": "Unternehmen, die bereits entschieden haben und Umsetzungshilfe suchen",
                "terms": [
                    f"{t} Prozesse optimieren",
                    f"{t} Einführung Schritt für Schritt",
                ],
                "business_relevance": "high",
            },
            {
                "intent": "informational",
                "description": "Frühphasige Recherche ohne unmittelbaren Handlungsdruck",
                "terms": [f"Was ist {t}"],
                "business_relevance": "medium",
            },
            {
                "intent": "comparison",
                "description": "Evaluation zwischen Lösungsansätzen",
                "terms": [f"{t} vs. manuelle Prozesse", f"{t} Anbieter Vergleich"],
                "business_relevance": "high",
            },
        ],
        "reranked_opportunities": [
            {
                "rank": 1,
                "term": f"Beratung zur {t}",
                "intent": "lead_generation",
                "opportunity_score": 93,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "Service-Landing-Page",
                "cta_angle": f"Kostenlosen {t}-Check anfragen",
                "why_ranked_here": (
                    f"Diese Suchanfrage signalisiert direkte Beauftragungsabsicht: {aud} suchen "
                    f"aktiv nach externer Unterstützung bei {t}. Die Konversionsnähe ist maximal, "
                    f"weil Informationssuche und Entscheidungsbereitschaft zusammenfallen. "
                    f"Eine optimierte Landing Page mit Audit-CTA ist der direkteste Pfad zu qualifizierten Leads."
                ),
            },
            {
                "rank": 2,
                "term": f"{t} beauftragen",
                "intent": "lead_generation",
                "opportunity_score": 90,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "Service-Landing-Page mit Prozessübersicht",
                "cta_angle": "Workflow-Potenzial analysieren lassen",
                "why_ranked_here": (
                    f"'Beauftragen'-Formulierungen zeigen, dass {aud} die Entscheidung "
                    f"bereits getroffen haben und jetzt einen Partner suchen. "
                    f"Dieses Keyword hat maximale Konversionsnähe: Der Interessent sucht jemanden, "
                    f"der die Arbeit übernimmt. Eine Landing Page mit klarem Ablauf und Erstgespräch-CTA konvertiert direkt."
                ),
            },
            {
                "rank": 3,
                "term": f"Kosten {t} Beratung",
                "intent": "commercial_investigation",
                "opportunity_score": 85,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "Preisratgeber mit Lead-Capture",
                "cta_angle": "Kosteneinschätzung für KI-Automatisierung anfragen",
                "why_ranked_here": (
                    f"Kosten-Anfragen signalisieren, dass ein Budget geprüft wird — "
                    f"ein starkes Kaufabsichtssignal. {aud} sind in der Entscheidungsphase "
                    f"und benötigen Orientierung. Ein Preisratgeber, der Transparenz schafft und "
                    f"gleichzeitig zum Erstgespräch einlädt, ist ein idealer Lead-Generator."
                ),
            },
            {
                "rank": 4,
                "term": f"{t} Agentur",
                "intent": "lead_generation",
                "opportunity_score": 83,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "medium",
                "conversion_closeness": "high",
                "suggested_content_format": "Positionierungs-Landingpage",
                "cta_angle": f"Beratungsgespräch zur {t} buchen",
                "why_ranked_here": (
                    f"Wer nach einer '{t} Agentur' sucht, hat die Entscheidung zur Beauftragung "
                    f"bereits getroffen. Die Frage ist nur noch: Welcher Anbieter? "
                    f"Eine klare Positionierungsseite, die Kompetenz und Referenzen zeigt, "
                    f"gewinnt im direkten Vergleich mit generischen Anbietern — "
                    f"besonders bei {aud}, die konkrete Expertise erwarten."
                ),
            },
            {
                "rank": 5,
                "term": f"{t} Mittelstand",
                "intent": "commercial_investigation",
                "opportunity_score": 79,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "Zielgruppen-Landing-Page",
                "cta_angle": "KI-Automatisierungs-Potenzial für Ihr Unternehmen prüfen",
                "why_ranked_here": (
                    f"Mittelständler haben spezifische Anforderungen und Budgets, "
                    f"die sich von Enterprise-Projekten unterscheiden. "
                    f"Eine Seite, die genau auf diese Zielgruppe ausgerichtet ist, "
                    f"reduziert Streuverluste und spricht {aud} direkt an — "
                    f"mit höherer Relevanz als generische Beratungsseiten."
                ),
            },
            {
                "rank": 6,
                "term": f"Praxisbeispiele {t} Unternehmen",
                "intent": "commercial_investigation",
                "opportunity_score": 74,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "medium",
                "conversion_closeness": "high",
                "suggested_content_format": "Fallstudien mit konkreten Ergebnissen",
                "cta_angle": f"Erfahren, wie andere Unternehmen {t} umgesetzt haben",
                "why_ranked_here": (
                    f"In der Evaluierungsphase suchen {aud} nach konkreten Belegen, "
                    f"dass {t} in der Praxis funktioniert. Fallstudien mit messbaren Ergebnissen "
                    f"bauen Vertrauen auf und beschleunigen die Entscheidung — "
                    f"besonders wenn sie branchenspezifisch aufgebaut sind."
                ),
            },
            {
                "rank": 7,
                "term": f"{t} einführen lassen",
                "intent": "lead_generation",
                "opportunity_score": 70,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "Service-Seite mit Umsetzungsprozess",
                "cta_angle": "KI-Workflow-Audit starten",
                "why_ranked_here": (
                    f"'Einführen lassen' signalisiert, dass {aud} die Umsetzung "
                    f"nicht selbst übernehmen möchten — maximale Delegationsabsicht. "
                    f"Diese Suchanfrage landet direkt bei Interessenten, die einen erfahrenen "
                    f"Implementierungspartner suchen, und konvertiert mit einer klaren CTA sehr hoch."
                ),
            },
        ],
        "content_ideas": [
            {
                "title": f"Beratung zur {t}: Kosten, Ablauf und was Sie erwarten können",
                "format": "Ratgeber",
                "target_terms": [
                    f"Kosten {t} Beratung",
                    f"{t} beauftragen",
                    f"Praxisbeispiele {t} Unternehmen",
                ],
                "rationale": "Kombiniert Kosten- und Umsetzungsrecherche — zwei der stärksten Lead-Signale — in einem Dokument mit klarer CTA am Ende.",
            },
            {
                "title": f"{t} im Mittelstand: Praxisbeispiele und Umsetzungserfahrungen",
                "format": "Fallstudie",
                "target_terms": [
                    f"{t} Mittelstand",
                    f"Praxisbeispiele {t} Unternehmen",
                    f"{t} ROI Praxisbeispiele",
                ],
                "rationale": "Fallstudien mit Mittelstandsfokus sprechen die Zielgruppe direkt an und bauen Vertrauen durch konkrete, nachvollziehbare Ergebnisse.",
            },
            {
                "title": f"{t} beauftragen: Worauf es ankommt und worauf Sie achten sollten",
                "format": "Ratgeber",
                "target_terms": [f"{t} beauftragen", f"{t} Agentur", f"{t} Experten Unternehmen"],
                "rationale": "Ratgeber für Beauftragungsentscheidungen ranken für direkten Hire-Intent und positionieren den Autor als vertrauenswürdige erste Wahl.",
            },
            {
                "title": f"{t} einführen: 10 Schritte für eine erfolgreiche Umsetzung",
                "format": "Checkliste",
                "target_terms": [f"{t} Einführung Schritt für Schritt", f"{t} einführen lassen"],
                "rationale": "Checklisten eignen sich als Lead-Magnet und ranken stark für Umsetzungs-Intent. Download-Gate schafft direkten E-Mail-Kontakt.",
            },
            {
                "title": f"{t} vs. manuelle Prozesse: Ein ehrlicher Vergleich für Entscheidungsträger",
                "format": "Vergleichsartikel",
                "target_terms": [f"{t} vs. manuelle Prozesse", f"{t} Anbieter Vergleich"],
                "rationale": "Ehrliche Vergleichsartikel gewinnen Vertrauen und ermöglichen es, den Entscheidungsrahmen im eigenen Sinne zu definieren.",
            },
        ],
        "lead_generation_angles": [
            {
                "angle": f"Kostenloses {t}-Erstgespräch",
                "cta": "Kostenlosen KI-Automatisierungs-Check anfragen",
                "target_terms": [f"Beratung zur {t}", f"{t} Agentur"],
                "rationale": f"Ein unverbindliches Erstgespräch reduziert die Einstiegshürde für {aud} und erzeugt direkte Pipeline aus den Intent-stärksten Seiten.",
            },
            {
                "angle": "Workflow-Potenzialanalyse (kostenlos)",
                "cta": "Automatisierungs-Ideen für mein Unternehmen prüfen",
                "target_terms": [f"{t} beauftragen", f"{t} Mittelstand"],
                "rationale": f"Eine strukturierte Analyse bietet sofortigen Mehrwert und qualifiziert gleichzeitig den Lead — ideal für {aud} mit mittelfristigem Entscheidungshorizont.",
            },
            {
                "angle": f"{t}-Checkliste als Lead-Magnet",
                "cta": f"Kostenlose {t}-Einführungscheckliste herunterladen",
                "target_terms": [f"{t} Einführung Schritt für Schritt", f"{t} einführen lassen"],
                "rationale": "Checklisten konvertieren gut auf Umsetzungs-Intent-Seiten und bauen eine qualifizierte E-Mail-Liste mit Interessenten auf, die aktiv planen.",
            },
        ],
        "roadmap": [
            {
                "phase": "Phase 1 — Lead-Intent Foundation (Wochen 1–4)",
                "focus": "Service-Seiten für direkten Beauftragungsintent erstellen und optimieren",
                "items": [
                    f"Landing Page für 'Beratung zur {t}' erstellen oder optimieren",
                    f"Service-Seite für '{t} beauftragen' mit Prozessübersicht und Erstgespräch-CTA",
                    f"Preisratgeber 'Kosten {t} Beratung' mit Lead-Capture-Formular veröffentlichen",
                    "Interne Verlinkung: alle neuen Seiten auf die primäre Service-Seite verlinken",
                ],
                "rationale": "Beauftragungsintent-Seiten generieren am schnellsten qualifizierte Leads. Diese Phase legt die Basis bevor Autoritäts-Content skaliert wird.",
            },
            {
                "phase": "Phase 2 — Vertrauen und Bewertung (Wochen 5–10)",
                "focus": "Evaluierungs-Content und Branchen-Referenzen aufbauen",
                "items": [
                    f"Fallstudie '{t} im Mittelstand' mit konkreten Ergebnissen veröffentlichen",
                    f"Vergleichsartikel '{t} vs. manuelle Prozesse' schreiben",
                    f"Ratgeber '{t} beauftragen: worauf es ankommt' erstellen",
                    "Internen Verlinkungsplan umsetzen: alle Ratgeber → primäre Service-Seiten",
                    "FAQ-Sektion für service-nahe Suchfragen auf der Hauptseite ergänzen",
                ],
                "rationale": "Evaluierungs-Content fängt Interessenten in der Recherchephase ab und stärkt die Domain-Autorität für Lead-Intent-Keywords.",
            },
            {
                "phase": "Phase 3 — Conversion und organische Skalierung (Wochen 11–16)",
                "focus": "Lead-Magnets in organische Seiten integrieren und CTAs optimieren",
                "items": [
                    f"'{t}-Einführungscheckliste' als Download-Lead-Magnet in Ratgeber integrieren",
                    "CTA-Strecken auf organischen Landing Pages A/B-testen",
                    "E-Mail-Nurturing-Sequenz für Checklisten-Downloads einrichten",
                    "Themencluster rund um verwandte Automatisierungs-Keywords ausbauen",
                    "Bestehende Seiten anhand der Top-5-Opportunities überarbeiten und optimieren",
                ],
                "rationale": "Nach dem Aufbau der Basis konvertieren Lead-Magnets und CTA-Optimierungen den bestehenden organischen Traffic effizienter und erschließen neue Keyword-Cluster.",
            },
        ],
        "warnings": ["Im Demo-Modus — OPENAI_API_KEY für KI-Analyse konfigurieren"],
        "metadata": {
            "model": "mock",
            "used_web_context": False,
            "market": market,
            "goal": goal,
            "disclaimer": "Scores are AI-assisted prioritization signals, not live search-volume metrics.",
        },
    }


def _build_mock_en(topic: str, audience: str, goal: str) -> dict:
    t = topic[:60]
    aud = audience or "decision-makers"
    return {
        "mode": "mock",
        "summary": (
            f"The SEO landscape for '{t}' shows its strongest opportunity in queries with "
            f"service demand, consulting intent, and implementation intent — not broad informational searches. "
            f"{aud.capitalize()} are looking for help doing something, not just reading about it. "
            f"A 3-phase strategy starting with high-intent service pages offers the fastest path to qualified leads."
        ),
        "extracted_business_context": {
            "business_type": "service / consulting",
            "core_service": t,
            "target_audience": aud,
            "value_proposition": f"Hands-on {t} expertise that reduces complexity and delivers measurable outcomes for {aud}",
            "pain_points": [
                "Hard to evaluate quality without deep domain expertise",
                "Implementation stalls without dedicated external support",
                "Unclear ROI before committing to a solution",
                "Fragmented tools without a clear integration path",
                "Internal resource gap for proper rollout",
            ],
            "competitive_differentiators": [
                "Deep domain expertise with hands-on delivery",
                "Transparent process with clear milestones",
                "Production-grade implementation, not just strategy decks",
            ],
        },
        "keyword_candidates": [
            {"term": f"{t} consulting for businesses", "type": "seed", "intent": "lead_generation"},
            {
                "term": f"{t} consulting cost",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
            {"term": f"outsource {t}", "type": "long-tail", "intent": "lead_generation"},
            {"term": f"{t} agency", "type": "seed", "intent": "lead_generation"},
            {"term": f"{t} for {aud}", "type": "long-tail", "intent": "commercial_investigation"},
            {"term": f"what is {t}", "type": "question", "intent": "informational"},
            {"term": f"how to implement {t}", "type": "implementation", "intent": "implementation"},
            {
                "term": f"{t} examples companies",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
            {"term": f"{t} vs manual processes", "type": "comparison", "intent": "comparison"},
            {"term": f"hire {t} expert", "type": "seed", "intent": "lead_generation"},
            {
                "term": f"{t} ROI examples",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
            {"term": f"{t} implementation guide", "type": "long-tail", "intent": "implementation"},
            {"term": f"{t} checklist", "type": "long-tail", "intent": "implementation"},
            {"term": f"best {t} provider", "type": "comparison", "intent": "comparison"},
            {
                "term": f"{t} case study results",
                "type": "long-tail",
                "intent": "commercial_investigation",
            },
        ],
        "intent_clusters": [
            {
                "intent": "lead_generation",
                "description": "Queries with direct service or consulting demand — ready to hire",
                "terms": [
                    f"{t} consulting for businesses",
                    f"outsource {t}",
                    f"{t} agency",
                    f"hire {t} expert",
                ],
                "business_relevance": "high",
            },
            {
                "intent": "commercial_investigation",
                "description": "Buyers comparing options and evaluating cost/ROI before committing",
                "terms": [
                    f"{t} consulting cost",
                    f"{t} for {aud}",
                    f"{t} examples companies",
                    f"{t} ROI examples",
                    f"{t} case study results",
                ],
                "business_relevance": "high",
            },
            {
                "intent": "implementation",
                "description": "Teams that have decided and are looking for how-to guidance",
                "terms": [
                    f"how to implement {t}",
                    f"{t} implementation guide",
                    f"{t} checklist",
                ],
                "business_relevance": "high",
            },
            {
                "intent": "informational",
                "description": "Early-stage research with no immediate action intent",
                "terms": [f"what is {t}"],
                "business_relevance": "medium",
            },
            {
                "intent": "comparison",
                "description": "Evaluation between solution approaches and providers",
                "terms": [f"{t} vs manual processes", f"best {t} provider"],
                "business_relevance": "high",
            },
        ],
        "reranked_opportunities": [
            {
                "rank": 1,
                "term": f"hire {t} expert",
                "intent": "lead_generation",
                "opportunity_score": 93,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "service landing page",
                "cta_angle": f"Book a free {t} strategy call",
                "why_ranked_here": (
                    f"This query signals that {aud} have already decided to get external help — "
                    f"they are actively evaluating who to hire. Conversion closeness is at its peak. "
                    f"A service landing page with a clear audit or consultation CTA captures this "
                    f"intent at its highest value point and converts at significantly higher rates "
                    f"than informational content."
                ),
            },
            {
                "rank": 2,
                "term": f"outsource {t}",
                "intent": "lead_generation",
                "opportunity_score": 90,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "service landing page with process overview",
                "cta_angle": f"Get a free {t} scope assessment",
                "why_ranked_here": (
                    f"'Outsource' phrasing means {aud} want to delegate — exactly the audience for "
                    f"external consulting. This query represents maximum delegation intent, "
                    f"and a landing page showing the engagement process with a clear first-step CTA "
                    f"converts this intent directly into qualified pipeline."
                ),
            },
            {
                "rank": 3,
                "term": f"{t} consulting cost",
                "intent": "commercial_investigation",
                "opportunity_score": 85,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "high",
                "conversion_closeness": "high",
                "suggested_content_format": "pricing guide with lead-capture CTA",
                "cta_angle": f"Get a custom {t} quote",
                "why_ranked_here": (
                    f"Cost queries signal active budget evaluation — {aud} are in the decision phase. "
                    f"A transparent pricing guide builds trust while positioning the business as "
                    f"the credible next step. A quote-request CTA on this page captures leads "
                    f"at the highest moment of buying intent."
                ),
            },
            {
                "rank": 4,
                "term": f"{t} agency",
                "intent": "lead_generation",
                "opportunity_score": 83,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "medium",
                "conversion_closeness": "high",
                "suggested_content_format": "positioning landing page",
                "cta_angle": f"Talk to a {t} specialist",
                "why_ranked_here": (
                    f"Searching for an agency means the outsourcing decision is made — "
                    f"the question is only which provider. A positioning page that clearly shows "
                    f"expertise, process, and results wins in direct comparison with generic providers. "
                    f"For {aud}, specificity and proof matter more than volume."
                ),
            },
            {
                "rank": 5,
                "term": f"{t} case study results",
                "intent": "commercial_investigation",
                "opportunity_score": 78,
                "lead_relevance": "high",
                "business_relevance": "high",
                "intent_fit": "strong",
                "content_gap_potential": "medium",
                "conversion_closeness": "high",
                "suggested_content_format": "case study with outcome metrics",
                "cta_angle": f"See how we delivered {t} results for clients like you",
                "why_ranked_here": (
                    f"Proof-seeking queries attract {aud} in the final evaluation stage — "
                    f"they have done their research and now need social proof. "
                    f"Case studies with specific, honest results reduce the last objections "
                    f"and directly accelerate the decision to reach out."
                ),
            },
            {
                "rank": 6,
                "term": f"how to implement {t}",
                "intent": "implementation",
                "opportunity_score": 68,
                "lead_relevance": "medium",
                "business_relevance": "high",
                "intent_fit": "moderate",
                "content_gap_potential": "high",
                "conversion_closeness": "medium",
                "suggested_content_format": "implementation guide with expert CTA",
                "cta_angle": f"Need expert support with {t} implementation? Let's talk.",
                "why_ranked_here": (
                    f"Implementation queries reach {aud} who have committed to the solution "
                    f"and are now looking for how to do it right. "
                    f"A detailed guide that mid-way offers expert implementation support "
                    f"captures the subset who realise they need external help — "
                    f"converting organic traffic into consulting leads."
                ),
            },
            {
                "rank": 7,
                "term": f"what is {t}",
                "intent": "informational",
                "opportunity_score": 52,
                "lead_relevance": "low",
                "business_relevance": "medium",
                "intent_fit": "moderate",
                "content_gap_potential": "medium",
                "conversion_closeness": "low",
                "suggested_content_format": "educational overview / pillar page",
                "cta_angle": f"Download the free {t} starter guide",
                "why_ranked_here": (
                    f"This top-of-funnel query reaches {aud} early in their research journey. "
                    f"Ranked lower because lead-generation priority means early-research traffic "
                    f"has lower immediate conversion value. Worth building for authority, "
                    f"but with a long-form piece that connects to higher-intent pages."
                ),
            },
        ],
        "content_ideas": [
            {
                "title": f"{t.title()} for Businesses: Costs, Process, and Typical Results",
                "format": "guide",
                "target_terms": [
                    f"{t} consulting cost",
                    f"how to implement {t}",
                    f"{t} examples companies",
                ],
                "rationale": "Combines cost research and implementation search — two of the strongest lead signals — in one document with a clear CTA at the end.",
            },
            {
                "title": f"How We Delivered {t.title()} Results: A Real Client Case Study",
                "format": "case study",
                "target_terms": [f"{t} case study results", f"{t} ROI examples"],
                "rationale": "Case studies with concrete outcomes build trust and reduce final objections at the decision stage.",
            },
            {
                "title": f"How to Hire a {t.title()} Expert: What to Look For, What to Ask",
                "format": "guide",
                "target_terms": [f"hire {t} expert", f"{t} agency"],
                "rationale": "Hire-intent guides rank for direct conversion queries and position the author as the credible answer.",
            },
            {
                "title": f"{t.title()} Checklist: 12 Steps Before You Start",
                "format": "checklist",
                "target_terms": [f"{t} checklist", f"how to implement {t}"],
                "rationale": "Checklists convert well as lead magnets on implementation-intent pages.",
            },
            {
                "title": f"{t.title()} vs. Manual Processes: An Honest Comparison",
                "format": "comparison article",
                "target_terms": [f"{t} vs manual processes", f"best {t} provider"],
                "rationale": "Comparison content attracts evaluation-stage buyers and lets you frame the decision on your own terms.",
            },
        ],
        "lead_generation_angles": [
            {
                "angle": f"Free {t} Strategy Session",
                "cta": f"Book a free 30-minute {t} strategy call",
                "target_terms": [f"hire {t} expert", f"{t} consulting for businesses"],
                "rationale": "A free session lowers entry friction for high-intent buyers and creates direct pipeline from the strongest intent pages.",
            },
            {
                "angle": f"{t.title()} Scope Assessment (Free)",
                "cta": f"Get your free {t} scope assessment",
                "target_terms": [f"outsource {t}", f"{t} agency"],
                "rationale": "A scope assessment provides immediate value to delegation-intent prospects and qualifies them in the same conversation.",
            },
            {
                "angle": "Custom Quote / Pricing Request",
                "cta": f"Get a personalised {t} quote in 48 hours",
                "target_terms": [f"{t} consulting cost"],
                "rationale": "Cost-intent pages with instant quote CTAs capture leads at the highest moment of purchase intent.",
            },
        ],
        "roadmap": [
            {
                "phase": "Phase 1 — Lead-Intent Foundation (Weeks 1–4)",
                "focus": "Build service pages that capture direct hiring and consulting intent",
                "items": [
                    f"Create or optimise the service landing page for 'hire {t} expert'",
                    f"Build a transparent pricing page for '{t} consulting cost' with quote CTA",
                    f"Add a case study page targeting '{t} case study results'",
                    "Ensure every high-intent page has a visible, specific CTA above the fold",
                ],
                "rationale": "High-intent pages generate qualified leads fastest. Start here before building content volume.",
            },
            {
                "phase": "Phase 2 — Authority and Evaluation Content (Weeks 5–10)",
                "focus": "Build trust-building content for the evaluation and comparison stage",
                "items": [
                    f"Publish the '{t} vs manual processes' comparison article",
                    f"Write the '{t} implementation guide' targeting mid-funnel searchers",
                    f"Create the '{t} checklist' for implementation-intent visitors (with download gate)",
                    "Add internal links from all content to service pages",
                ],
                "rationale": "Evaluation content captures mid-funnel searchers and builds the domain authority that lifts all lead-intent pages.",
            },
            {
                "phase": "Phase 3 — Conversion Scale (Weeks 11–16)",
                "focus": "Expand reach, add lead magnets, and optimise conversion paths",
                "items": [
                    f"Publish the comprehensive '{t} for businesses' pillar page",
                    "Set up retargeting audiences based on Phase 1 page visitors",
                    "Build email sequence for checklist downloads",
                    "Repurpose top Phase 2 content as short videos and social proof snippets",
                ],
                "rationale": "After the foundation is live, conversion optimisation and retargeting compound the value of existing traffic.",
            },
        ],
        "warnings": ["Running in mock mode — set OPENAI_API_KEY for live AI analysis"],
        "metadata": {
            "model": "mock",
            "used_web_context": False,
            "market": "English",
            "goal": goal,
            "disclaimer": "Scores are AI-assisted prioritization signals, not live search-volume metrics.",
        },
    }


# ─── Route ────────────────────────────────────────────────────────────────────


@router.post("/seo-strategy/run")
@limiter.limit(f"{settings.SEO_MAX_REQUESTS_PER_HOUR}/hour")
@limiter.limit(f"{settings.SEO_MAX_REQUESTS_PER_DAY}/day")
async def run_seo_strategy(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"message": "Invalid JSON."}, status_code=400)

    # Honeypot — popped from the raw body before schema validation so the
    # field never reaches application logic and extra="forbid" doesn't
    # reject it as an unknown field. Silent pass, appears successful to bots.
    honey = body.pop("_honey", "") if isinstance(body, dict) else ""

    try:
        req = SeoStrategyRequest.model_validate(body)
    except Exception:
        return JSONResponse(
            {"message": "Invalid request. Please check your input."}, status_code=400
        )

    if honey != "":
        return JSONResponse(_build_mock(req.topic, req.audience, req.market, req.goal))

    if _is_unsafe(req.topic) or _is_unsafe(req.audience):
        return JSONResponse(
            {
                "message": "This request cannot be processed in the public demo.",
                "code": "unsafe_input",
            },
            status_code=400,
        )

    if settings.OPENAI_API_KEY:
        try:
            result = await _run_live(req.topic, req.audience, req.market, req.goal, req.url)
            return JSONResponse(result)
        except Exception:
            return JSONResponse(
                {"message": "The SEO strategy workflow encountered an error. Please try again."},
                status_code=500,
            )

    return JSONResponse(_build_mock(req.topic, req.audience, req.market, req.goal))
