"""Skill loader — detects drafting intent, resolves and loads skill files.

Supports local YAML skills and CaseMark MCP fallback for unknown doc types.
LLM-assisted extraction converts CaseMark markdown into structured skill dicts.
"""

from __future__ import annotations

import json as _json
import logging
import os
import re
import time
from pathlib import Path

import httpx
import yaml

from app.config import settings

log = logging.getLogger(__name__)

CASEMARK_MCP_URL = "https://skills.case.dev/api/mcp"

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"
CACHE_DIR = Path(settings.SKILL_CACHE_DIR)

# Keyword → skill slug mapping (lowercase)
SKILL_REGISTRY: dict[str, str] = {
    # NDA variants
    "nda": "nda_kenya",
    "non-disclosure": "nda_kenya",
    "non disclosure": "nda_kenya",
    "confidentiality agreement": "nda_kenya",
    "secrecy agreement": "nda_kenya",
    # Legal memorandum
    "legal memo": "legal_memorandum_kenya",
    "legal memorandum": "legal_memorandum_kenya",
    "memo of law": "legal_memorandum_kenya",
    "research memo": "legal_memorandum_kenya",
    "opinion memo": "legal_memorandum_kenya",
    "legal opinion": "legal_memorandum_kenya",
    "legal analysis": "legal_memorandum_kenya",
    # Demand letter
    "demand letter": "demand_letter_kenya",
    "demand notice": "demand_letter_kenya",
    "letter of demand": "demand_letter_kenya",
    "debt recovery letter": "demand_letter_kenya",
    "notice of demand": "demand_letter_kenya",
    "pre-litigation letter": "demand_letter_kenya",
    "notice to pay": "demand_letter_kenya",
    # Employment contract
    "employment contract": "employment_contract_kenya",
    "employment agreement": "employment_contract_kenya",
    "service contract": "employment_contract_kenya",
    # Lease
    "lease agreement": "lease_agreement_kenya",
    "tenancy agreement": "lease_agreement_kenya",
    "rental agreement": "lease_agreement_kenya",
    # Sale agreement
    "sale agreement": "sale_agreement_kenya",
    "purchase agreement": "sale_agreement_kenya",
    # Power of attorney
    "power of attorney": "power_of_attorney_kenya",
    # Will / testament
    "will": "will_testament_kenya",
    "testament": "will_testament_kenya",
    "last will": "will_testament_kenya",
    # Partnership deed
    "partnership deed": "partnership_deed_kenya",
    "partnership agreement": "partnership_deed_kenya",
}

# Verbs that signal drafting intent (not just research)
DRAFTING_VERBS = [
    "draft", "prepare", "create", "write", "generate", "make",
    "draw up", "put together", "compose", "formulate",
]

# Document type nouns that confirm it's a drafting task
DOCUMENT_NOUNS = [
    "agreement", "contract", "letter", "memo", "memorandum",
    "deed", "policy", "notice", "document", "nda",
    "lease", "will", "testament", "affidavit", "declaration",
    "power of attorney", "certificate", "resolution", "minutes",
    "brief", "petition", "complaint", "motion", "plaint",
    "statement of claim", "statement of defence", "reply",
]


def detect_drafting_intent(message: str) -> tuple[bool, str, str]:
    """Detect if a message is requesting document drafting.

    Returns:
        (is_drafting, doc_type_label, skill_slug)
        - is_drafting: True if this is a drafting request
        - doc_type_label: Human-readable doc type (e.g. "NDA", "Legal Memorandum")
        - skill_slug: The skill file to load (e.g. "nda_kenya")
    """
    msg_lower = message.lower().strip()

    # Check for drafting verb + document noun pattern
    has_drafting_verb = any(verb in msg_lower for verb in DRAFTING_VERBS)
    has_doc_noun = any(noun in msg_lower for noun in DOCUMENT_NOUNS)

    if not (has_drafting_verb and has_doc_noun):
        return False, "", ""

    # Match against skill registry (longest match first)
    sorted_keywords = sorted(SKILL_REGISTRY.keys(), key=len, reverse=True)
    for keyword in sorted_keywords:
        if keyword in msg_lower:
            slug = SKILL_REGISTRY[keyword]
            skill = load_skill(slug)
            if skill:
                return True, skill.get("title", keyword.title()), slug

    # Drafting intent detected but no local skill — try CaseMark MCP fallback
    mcp_skill = fetch_from_casemark_mcp(message)
    if mcp_skill:
        return True, mcp_skill.get("title", "Legal Document"), "__mcp__"

    # No match anywhere
    return True, "Legal Document", ""


def load_skill(slug: str) -> dict | None:
    """Load a skill YAML file from the skills directory, or from MCP cache.

    Returns the parsed skill dict, or None if not found.
    """
    if slug == "__mcp__":
        return _mcp_skill_cache.get("latest")

    log.info(f"Loading skill: slug={slug}, SKILLS_DIR={SKILLS_DIR}, exists={SKILLS_DIR.exists()}")

    filepath = SKILLS_DIR / f"{slug}.yaml"
    if not filepath.exists():
        # List what IS in the skills directory for debugging
        if SKILLS_DIR.exists():
            files = list(SKILLS_DIR.glob("*"))
            log.warning(f"Skill file not found: {filepath}. Files in dir: {[f.name for f in files]}")
        else:
            log.warning(f"Skills directory does not exist: {SKILLS_DIR}")
        return None

    try:
        with open(filepath, "r") as f:
            skill = yaml.safe_load(f)
        log.info(f"Loaded skill: {slug} ({skill.get('title', 'unknown')})")
        return skill
    except Exception as e:
        log.error(f"Failed to load skill {slug}: {e}")
        return None


# In-memory cache for MCP-fetched skills (avoids double fetch within a request)
_mcp_skill_cache: dict[str, dict] = {}


# ---------- Persistent filesystem cache ----------


def _cache_path(slug: str) -> Path:
    """Return the filesystem cache path for a CaseMark skill slug."""
    return CACHE_DIR / f"{slug}.json"


def _read_cache(slug: str, max_age_hours: int | None = None) -> dict | None:
    """Read a cached skill from filesystem.

    Returns the skill dict, or None if missing or expired.
    max_age_hours defaults to settings.SKILL_CACHE_TTL_HOURS (168 = 7 days).
    """
    if max_age_hours is None:
        max_age_hours = settings.SKILL_CACHE_TTL_HOURS

    path = _cache_path(slug)
    if not path.exists():
        return None
    try:
        data = _json.loads(path.read_text())
        fetched_at = data.get("fetched_at", 0)
        if time.time() - fetched_at > max_age_hours * 3600:
            return None
        return data.get("skill")
    except Exception:
        return None


def _write_cache(slug: str, raw_text: str, skill: dict):
    """Persist an extracted skill to the filesystem cache."""
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _cache_path(slug).write_text(_json.dumps({
            "slug": slug,
            "raw_text": raw_text,
            "skill": skill,
            "fetched_at": time.time(),
        }, indent=2, default=str))
        log.info(f"Cached CaseMark skill: {slug}")
    except Exception as e:
        log.warning(f"Failed to write skill cache for {slug}: {e}")


# ---------- LLM-assisted skill extraction ----------


SKILL_EXTRACTION_PROMPT = """You are a legal document structure analyst. Extract structured drafting metadata from the following CaseMark skill instructions.

## CaseMark Skill Text
{skill_text}

## Task
Parse this skill and produce a structured breakdown:

1. **sections**: Identify ALL distinct document sections/clauses described in the skill. Then group them into 4-5 logical sections appropriate for THIS document type. Do NOT default to generic names like "PREAMBLE / MAIN PROVISIONS / GENERAL PROVISIONS / SIGNATURES" unless that genuinely fits this document. Choose headings that reflect the actual content.

   For each grouped section, include a topic_brief listing ALL the topics/clauses assigned to that group so the drafter knows exactly what to cover.

   Examples of good groupings:
   - Shareholder agreement: PARTIES AND DEFINITIONS, SHARE CAPITAL AND TRANSFERS, GOVERNANCE AND VOTING, PROTECTIVE PROVISIONS AND EXIT, GENERAL AND EXECUTION
   - Board resolution: RESOLUTION HEADER, RECITALS, RESOLVING CLAUSES, CERTIFICATION
   - Legal memorandum: INTRODUCTION, ISSUE AND RULE, ANALYSIS, CONCLUSION

2. **intake_questions** (4-8): Specific questions to ask the user before drafting. Extract from prerequisites, required inputs, or "gather before drafting" sections. Each needs an id (snake_case), question text, and whether it's required.

3. **quality_checklist** (4-10): Specific quality checks for this document type. Extract from checklist items or quality criteria. If none explicit, derive from the skill's verification/pitfall sections.

4. **statutes**: Any statutes, laws, or regulations referenced.

5. **title**: The document type title (e.g. "Shareholder Agreement", "Board Resolution").

Respond with EXACTLY this JSON:
{{
  "title": "Document Type Title",
  "sections": [
    {{"id": "snake_case_id", "heading": "SECTION HEADING", "topic_brief": "Covers: topic A, topic B, topic C. Specifically address: key detail from skill instructions."}}
  ],
  "intake_questions": [
    {{"id": "snake_case_id", "question": "The question text", "required": true}}
  ],
  "quality_checklist": ["Check item 1", "Check item 2"],
  "statutes": ["Statute Name 1"]
}}"""


def _extract_skill_with_llm(raw_text: str, query: str) -> dict | None:
    """Use LLM to extract structured skill metadata from CaseMark markdown.

    Returns a structured dict with sections, intake_questions, quality_checklist,
    statutes, and title. Returns None if extraction fails (caller should fall back).

    Cost: ~1-2K input tokens, ~500 output tokens. Called once per new MCP skill.
    """
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            openai_api_key=settings.OPENROUTER_API_KEY,
            openai_api_base=settings.OPENROUTER_BASE_URL,
            temperature=0.0,
        )

        prompt = SKILL_EXTRACTION_PROMPT.format(skill_text=raw_text[:8000])
        response = llm.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Extract the structured skill metadata now."),
        ])

        extracted = _json.loads(response.content)

        # Validate minimum structure
        sections = extracted.get("sections", [])
        if not sections or len(sections) < 2:
            log.warning("LLM extraction returned insufficient sections, falling back to generic")
            return None

        log.info(f"LLM extraction succeeded: {len(sections)} sections, "
                 f"{len(extracted.get('intake_questions', []))} intake questions, "
                 f"{len(extracted.get('quality_checklist', []))} checklist items")
        return extracted

    except _json.JSONDecodeError as e:
        log.warning(f"LLM skill extraction returned invalid JSON: {e}")
        return None
    except Exception as e:
        log.warning(f"LLM skill extraction failed: {e}")
        return None


# ---------- CaseMark MCP fetch ----------


def fetch_from_casemark_mcp(query: str) -> dict | None:
    """Query CaseMark MCP for a matching skill.

    Uses the JSON-RPC 2.0 protocol:
    1. resolve_skill — finds best matching skill by query
    2. read_skill — fetches full skill content
    3. LLM extraction — converts markdown into structured skill dict

    Checks persistent filesystem cache before making HTTP calls.
    Returns a skill dict compatible with our local format, or None.
    """
    resolved_slug = None

    try:
        # Step 1: Resolve skill slug
        resolve_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "resolve_skill",
                "arguments": {"query": query},
            },
        }

        # Build headers — include API key if configured
        mcp_headers = {"Content-Type": "application/json"}
        if settings.CASEMARK_API_KEY:
            mcp_headers["Authorization"] = f"Bearer {settings.CASEMARK_API_KEY}"

        with httpx.Client(timeout=15, headers=mcp_headers) as client:
            res = client.post(CASEMARK_MCP_URL, json=resolve_payload)
            if res.status_code != 200:
                log.warning(f"CaseMark MCP resolve failed: {res.status_code}")
                return None

            resolve_data = res.json()
            result = resolve_data.get("result", {})

            content = result.get("content", [])
            if not content:
                return None

            skill_text = ""
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    skill_text = item.get("text", "")
                    break

            if not skill_text:
                return None

            # Extract slug from resolve response
            slug_match = re.search(r'"slug":\s*"([a-z0-9-]+)"', skill_text)
            if not slug_match:
                slug_match = re.search(r"/skills/([a-z0-9-]+)", skill_text)

            if slug_match:
                resolved_slug = slug_match.group(1)

                # Check persistent cache before read_skill call
                cached = _read_cache(resolved_slug)
                if cached:
                    log.info(f"CaseMark skill loaded from cache: {resolved_slug}")
                    _mcp_skill_cache["latest"] = cached
                    return cached

            if not resolved_slug:
                # No slug found — use resolve text directly
                skill = _parse_mcp_skill_text(skill_text, query)
                _mcp_skill_cache["latest"] = skill
                return skill

            # Step 2: Read full skill
            read_payload = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "read_skill",
                    "arguments": {"slug": resolved_slug},
                },
            }

            res2 = client.post(CASEMARK_MCP_URL, json=read_payload)

            # Handle rate limiting
            if res2.status_code == 429:
                log.warning("CaseMark rate limit hit (429). Falling back to expired cache.")
                expired = _read_cache(resolved_slug, max_age_hours=999999)
                if expired:
                    _mcp_skill_cache["latest"] = expired
                    return expired
                # Fall back to resolve result
                skill = _parse_mcp_skill_text(skill_text, query)
                _mcp_skill_cache["latest"] = skill
                return skill

            if res2.status_code != 200:
                skill = _parse_mcp_skill_text(skill_text, query)
                _mcp_skill_cache["latest"] = skill
                return skill

            read_data = res2.json()
            read_result = read_data.get("result", {})
            read_content = read_result.get("content", [])

            full_text = ""
            for item in read_content:
                if isinstance(item, dict) and item.get("type") == "text":
                    full_text = item.get("text", "")
                    break

            # Check for rate limit error in response body
            if full_text:
                try:
                    body = _json.loads(full_text)
                    if body.get("error"):
                        log.warning(f"CaseMark read_skill error: {body.get('message', 'unknown')}")
                        expired = _read_cache(resolved_slug, max_age_hours=999999)
                        if expired:
                            _mcp_skill_cache["latest"] = expired
                            return expired
                        skill = _parse_mcp_skill_text(skill_text, query)
                        _mcp_skill_cache["latest"] = skill
                        return skill
                    # Extract the content field from the JSON wrapper
                    full_text = body.get("content", full_text)
                except (_json.JSONDecodeError, TypeError):
                    pass  # Not JSON-wrapped, use as-is

            if full_text:
                skill = _parse_mcp_skill_text(full_text, query)
                skill["name"] = resolved_slug
                _mcp_skill_cache["latest"] = skill
                # Persist to filesystem cache
                _write_cache(resolved_slug, full_text, skill)
                log.info(f"Loaded skill from CaseMark MCP: {resolved_slug}")
                return skill

    except Exception as e:
        log.warning(f"CaseMark MCP fallback failed: {e}")
        # Last resort: try expired cache if we resolved a slug
        if resolved_slug:
            expired = _read_cache(resolved_slug, max_age_hours=999999)
            if expired:
                log.info(f"Using expired cache after MCP failure: {resolved_slug}")
                _mcp_skill_cache["latest"] = expired
                return expired

    return None


# ---------- Skill text parsing ----------


def _parse_mcp_skill_text(text: str, query: str) -> dict:
    """Convert raw MCP skill text into our standard skill dict format.

    Uses LLM-assisted extraction to preserve CaseMark's rich structure
    (document-specific sections, intake questions, quality checklist).
    Falls back to generic structure if extraction fails.
    """
    # Extract title from first heading
    title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    default_title = title_match.group(1) if title_match else "Legal Document"

    # Try LLM extraction
    extracted = _extract_skill_with_llm(text, query)

    if extracted:
        title = extracted.get("title", default_title)
        sections = extracted.get("sections", [])
        intake_questions = extracted.get("intake_questions", [])
        quality_checklist = extracted.get("quality_checklist", [])
        statutes = extracted.get("statutes", [])

        # Build section defs with topic briefs
        section_defs = []
        for s in sections:
            section_defs.append({
                "id": s.get("id", f"section_{len(section_defs)}"),
                "heading": s.get("heading", f"Section {len(section_defs) + 1}"),
                "topic_brief": s.get("topic_brief", ""),
                "context_requirements": [],
            })

        # Build intake question defs
        intake_defs = []
        for q in intake_questions:
            intake_defs.append({
                "id": q.get("id", f"q_{len(intake_defs)}"),
                "question": q.get("question", ""),
                "required": q.get("required", True),
            })

        # Ensure minimum quality checklist
        if not quality_checklist:
            quality_checklist = [
                "Document adapted for Kenyan law",
                "All intake requirements addressed",
                "Signature blocks included",
            ]
    else:
        # Fallback: generic structure (current behavior, never worse than before)
        title = default_title
        section_defs = [
            {"id": "preamble", "heading": "PREAMBLE", "topic_brief": "", "context_requirements": []},
            {"id": "body", "heading": "MAIN PROVISIONS", "topic_brief": "", "context_requirements": []},
            {"id": "general", "heading": "GENERAL PROVISIONS", "topic_brief": "", "context_requirements": []},
            {"id": "signatures", "heading": "SIGNATURES", "topic_brief": "", "context_requirements": []},
        ]
        intake_defs = [
            {"id": "parties", "question": "Please provide the names and details of the parties involved.", "required": True},
            {"id": "purpose", "question": "What is the specific purpose or context for this document?", "required": True},
            {"id": "special_requirements", "question": "Are there any special requirements or provisions you need?", "required": False},
        ]
        quality_checklist = [
            "Document adapted for Kenyan law",
            "All intake requirements addressed",
            "Signature blocks included",
        ]
        statutes = []

    return {
        "name": "mcp-skill",
        "title": title,
        "jurisdiction": "Kenya",
        "doc_type": "custom",
        "description": f"CaseMark skill for: {query}",
        "statutes": statutes,
        "intake_questions": intake_defs,
        "sections": section_defs,
        "quality_checklist": quality_checklist,
        "drafting_instructions": (
            f"You are drafting a legal document based on the following expert skill instructions. "
            f"IMPORTANT: Adapt all content for Kenyan law and practice. Replace any US or UK-specific "
            f"references with equivalent Kenyan statutes and conventions.\n\n"
            f"## CaseMark Skill Instructions\n\n{text}"
        ),
    }


def get_intake_questions(skill: dict) -> list[dict]:
    """Extract intake questions from a skill, filtering to required ones first."""
    questions = skill.get("intake_questions", [])
    # Sort: required first, then optional
    required = [q for q in questions if q.get("required", False)]
    optional = [q for q in questions if not q.get("required", False)]
    return required + optional


def build_drafting_prompt(skill: dict, intake_answers: dict) -> str:
    """Build the full drafting system prompt from a skill + intake answers."""
    parts = []

    parts.append(f"# Drafting Task: {skill.get('title', 'Legal Document')}")
    parts.append(f"Jurisdiction: {skill.get('jurisdiction', 'Kenya')}")
    parts.append("")

    # Include intake context
    if intake_answers:
        parts.append("## Client Requirements (from intake)")
        for key, value in intake_answers.items():
            parts.append(f"- **{key}**: {value}")
        parts.append("")

    # Include section structure
    sections = skill.get("sections", [])
    if sections:
        parts.append("## Required Document Sections")
        for s in sections:
            parts.append(f"- {s.get('heading', s.get('id', ''))}")
        parts.append("")

    # Include drafting instructions
    instructions = skill.get("drafting_instructions", "")
    if instructions:
        parts.append("## Drafting Instructions")
        parts.append(instructions)
        parts.append("")

    # Include quality checklist
    checklist = skill.get("quality_checklist", [])
    if checklist:
        parts.append("## Quality Checklist (verify before finalizing)")
        for item in checklist:
            parts.append(f"- [ ] {item}")
        parts.append("")

    return "\n".join(parts)


def list_available_skills() -> list[dict]:
    """List all available skill files with metadata."""
    skills = []
    if not SKILLS_DIR.exists():
        return skills

    for filepath in SKILLS_DIR.glob("*.yaml"):
        try:
            with open(filepath, "r") as f:
                skill = yaml.safe_load(f)
            skills.append({
                "slug": filepath.stem,
                "name": skill.get("name", filepath.stem),
                "title": skill.get("title", ""),
                "doc_type": skill.get("doc_type", ""),
                "description": skill.get("description", ""),
                "jurisdiction": skill.get("jurisdiction", ""),
            })
        except Exception:
            pass

    return skills
