"""Lawlyfy Drafting Agent — structured document generation with canvas support.

Architecture:
  intake → research → draft_sections → refine (re-entrant) → END

The drafting agent generates legal documents section-by-section, guided by
skill files that define the document structure, intake questions, and
drafting instructions. It streams canvas events so the frontend can render
a live editable document.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated, Any, Sequence

from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import TypedDict

from app.config import settings
from app.agent.tools.rag_vector import search_vector_db
from app.agent.tools.rag_graph import query_knowledge_graph
from app.agent.tools.web_search import web_search
from app.agent.tools.skill_loader import (
    build_drafting_prompt,
    get_intake_questions,
    load_skill,
)
from app.agent.legal_agent import _dedup_citations

log = logging.getLogger(__name__)


# ---------- State ----------


class DraftingAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    citations: list[dict[str, Any]]
    web_enabled: bool
    # Skill context
    skill: dict[str, Any]
    skill_slug: str
    doc_type: str
    # Intake
    intake_answers: dict[str, str]
    intake_complete: bool
    # Drafting
    sections: list[dict[str, Any]]
    # Format: [{"id": "preamble", "heading": "PREAMBLE", "content": "...", "order": 0}]
    current_section_idx: int
    # Refinement
    refinement_count: int
    # Canvas
    canvas_id: str


# ---------- LLM ----------


def _get_llm(temperature: float = 0.1):
    return ChatOpenAI(
        model=settings.LLM_MODEL,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
        temperature=temperature,
        streaming=True,
    )


# ---------- Tools ----------


import re as _re


def _strip_leading_heading(content: str, heading: str) -> str:
    """Remove leading markdown headers that duplicate the section heading.

    LLMs sometimes prepend '### [id] HEADING' or '## 3. HEADING' to the
    content even when told not to.  This strips those lines so the canvas
    doesn't render the heading twice.
    """
    lines = content.lstrip("\n").split("\n", 1)
    if not lines:
        return content
    first = lines[0].strip()
    # Matches: ### ..., ## ..., # ...
    if first.startswith("#"):
        # Check if the heading text appears in this line (case-insensitive)
        heading_words = _re.sub(r"[^a-z0-9\s]", "", heading.lower()).split()
        first_lower = _re.sub(r"[^a-z0-9\s]", "", first.lower())
        # If most heading words appear in the first line, it's a duplicate
        if heading_words and sum(1 for w in heading_words if w in first_lower) >= len(heading_words) * 0.6:
            return lines[1].lstrip("\n") if len(lines) > 1 else ""
    return content


CORE_TOOLS = [search_vector_db, query_knowledge_graph]
ALL_TOOLS = CORE_TOOLS + [web_search]
TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}

MAX_TOOL_ROUNDS = 3


def _run_tool_calls(tool_calls: list[dict]) -> tuple[list[ToolMessage], list[dict]]:
    """Execute tool calls. Returns (tool_messages, new_citations)."""
    results = []
    new_citations = []

    for tc in tool_calls:
        tool_fn = TOOLS_BY_NAME.get(tc["name"])
        if tool_fn is None:
            content = json.dumps({"error": f"Unknown tool: {tc['name']}"})
        else:
            content = tool_fn.invoke(tc["args"])

        try:
            parsed = json.loads(content)
            if "citations" in parsed:
                new_citations.extend(parsed["citations"])
        except (json.JSONDecodeError, TypeError):
            pass

        results.append(ToolMessage(content=content, tool_call_id=tc["id"]))

    return results, new_citations


# ---------- Prompts ----------


INTAKE_PROMPT = """You are a legal drafting assistant preparing to draft: {doc_title}

Your job is to gather the information needed before drafting. Here are the required fields:

{questions_text}

## CRITICAL INSTRUCTIONS — read carefully:

1. **Extract first.** Before asking ANY question, carefully read the user's message(s) and extract every piece of information they have already provided. Map it against the fields above. Users often provide multiple answers in a single message — acknowledge what you've captured.

2. **Only ask about genuine gaps.** If the user's message already answers a question (even partially or implicitly), do NOT ask it again. For example, if they say "mutual NDA for a fintech company", you already know the purpose (mutual NDA) and one party type (fintech company).

3. **Be conversational, not robotic.** Don't ask a rigid list. Acknowledge what the user provided, confirm your understanding, then ask only what's actually missing — and you can ask multiple related missing fields in one message.

4. **Respect context clues.** If the user mentions specific laws, industries, or transaction types, use that to infer answers. "NDA for a Kenyan fintech offering crypto wallets under VASP Act 2025" tells you: jurisdiction=Kenya, industry=fintech/crypto, relevant law=VASP Act 2025.

5. **When you have enough, complete intake.** Once you have answers for all REQUIRED fields (optional fields can use defaults), respond with EXACTLY this JSON and nothing else:
{{"intake_complete": true, "answers": {{"question_id": "answer", ...}}}}

Do NOT start drafting yet. Only gather the intake information."""

RESEARCH_PROMPT = """You are a legal researcher preparing to draft a document. Research the legal foundations needed.

Document type: {doc_title}
Jurisdiction: {jurisdiction}
Client requirements: {intake_summary}
Relevant statutes to search: {statutes}

Use the search tools to find:
1. Relevant statutory provisions
2. Case law on enforceability and best practices
3. Any regulatory requirements

Be focused — only search for what's directly relevant to this document. Maximum 2-3 tool calls."""

SECTION_DRAFTER_PROMPT = """You are an expert legal drafter. Generate the content for ONE section of a legal document.

{drafting_prompt}

## Current Task
Draft ONLY this section: **{section_heading}** (section ID: {section_id})

{topic_brief_block}

## Research Context
{research_context}

## Rules
1. Write in proper legal language appropriate for Kenyan legal practice
2. Use formal drafting conventions (defined terms capitalized, cross-references)
3. Reference applicable law where relevant using [n] citation notation
4. Fill in details from the intake answers — use placeholder brackets [PARTY NAME] only where specific info was not provided
5. Output ONLY the content for this section — no markdown headers, no section numbers (those are in the heading)
6. Be thorough but concise — legal documents should be precise, not verbose"""

REFINE_PROMPT = """You are an expert legal drafter working on a document canvas with the user. You have full context of the conversation, the current state of the document, and the legal drafting standards that govern this document type.

## Document: {doc_title}

## Original Requirements
{intake_summary}

## Drafting Standards & Legal Framework
{drafting_instructions}

## Quality Checklist (must be maintained)
{quality_checklist}

## Conversation History
{conversation_history}

## Current Document Sections
{current_sections}

## User's Latest Request
{user_message}

## Instructions
You have full context of the document, all prior conversations, and the legal standards that shaped the original draft. When making changes:
- Maintain compliance with the drafting standards and legal framework above
- Do not remove legally required provisions unless the user explicitly asks and you've warned them of the implications
- Ensure edits stay consistent with the quality checklist

Determine which section(s) need to be modified based on the user's request and provide the updated content.

Respond with EXACTLY this JSON format:
{{
  "updates": [
    {{"section_id": "the_section_id", "content": "the body text only", "heading": "NEW HEADING (only if user asked to change the heading, otherwise omit this field)"}}
  ],
  "explanation": "Brief, friendly explanation of what was changed and why"
}}

Rules:
1. Only modify sections that need to change — don't rewrite the whole document
2. Preserve legal precision and formal language
3. If the change has legal implications, note them in the explanation
4. Reference Kenyan law where relevant
5. **CRITICAL — content field must contain ONLY the body text.** Do NOT include the section heading, section number, section ID, or any markdown headers (###, ##, etc.) in the "content" field. The heading is rendered separately by the canvas. Including it in content causes duplicate headings.
6. Only include the "heading" field if the user explicitly asked to rename or change a section heading. Otherwise omit it entirely.
7. If the user's request is conversational (e.g. asking a question about the document rather than requesting a change), respond with:
   {{"updates": [], "explanation": "Your conversational response here"}}"""

ASSESS_PROMPT = """You are a senior legal quality assessor. For each section of this legal document, evaluate how complete and nuanced it is with per-topic granularity.

Document type: {doc_title}

## Intake Answers Provided
{intake_summary}

## Sections to Assess
{sections_with_requirements}

For EACH section:
1. Identify ALL distinct topics, clauses, or provisions within it (do not cap the number — list every topic present)
2. For each topic, assess confidence: "high" (well-grounded), "medium" (reasonable defaults), or "low" (placeholders or gaps)
3. Roll up to an overall section confidence — the LOWEST topic confidence wins
4. Write an enrichment_prompt that addresses the weakest topics specifically

Rules:
- Check for placeholder brackets like [PARTY NAME] or [DATE] — these indicate "low" confidence for that topic
- Prefix EVERY enrichment_prompt with "Co-Drafter:"
- Format the enrichment_prompt as structured bullet points, NOT prose:
  Line 1: Overall assessment sentence
  Then one bullet per weak topic: "• Topic Name — what's needed and why"
  Example: "Co-Drafter: This section covers the core provisions but has gaps in two areas.\n• Valuation Mechanics — No methodology specified; ask client: FMV appraisal, formula-based, or third-party?\n• Non-Compete Duration — Current 3-year restriction may be unenforceable under Kenyan law; consider capping at 12 months."
- For "high" confidence sections (all topics high), the enrichment_prompt should briefly confirm: "Co-Drafter: This section is well-grounded in the details you provided. No additional input needed."

Respond with EXACTLY this JSON:
{{
  "assessments": [
    {{
      "section_id": "the_id",
      "confidence": "high|medium|low",
      "enrichment_prompt": "Co-Drafter: Your specific message here",
      "topic_assessments": [
        {{"topic": "Topic name", "confidence": "high|medium|low", "note": "Brief note on status"}}
      ]
    }}
  ]
}}"""

REVIEW_PROMPT = """You are a senior legal quality reviewer. Review the following legal document draft against the quality checklist.

Document type: {doc_title}
Quality checklist:
{checklist}

Current document sections:
{sections_text}

For each section, check if it meets the quality standards. If you have a suggestion for improvement, provide it.

Respond with EXACTLY this JSON:
{{
  "suggestions": [
    {{"section_id": "the_section_id", "comment": "Your specific suggestion for improvement"}},
  ]
}}

Rules:
1. Only include suggestions where there's a genuine improvement opportunity
2. Be specific and actionable — "Consider adding..." not "This could be better"
3. Focus on legal completeness, not style
4. Maximum 3-4 suggestions for the most impactful improvements
5. If the document is solid, return an empty suggestions array"""


# ---------- Nodes ----------


def intake_node(state: DraftingAgentState) -> dict:
    """Process intake — either ask questions or parse answers."""
    skill = state.get("skill", {})
    messages = state.get("messages", [])
    intake_answers = dict(state.get("intake_answers", {}))

    questions = get_intake_questions(skill)
    if not questions:
        return {"intake_complete": True, "intake_answers": {}}

    llm = _get_llm(temperature=0.2)

    # Format questions for the prompt
    questions_text = ""
    for q in questions:
        req = " (REQUIRED)" if q.get("required") else " (optional)"
        opts = ""
        if q.get("options"):
            opts = f" Options: {', '.join(q['options'])}"
        default = ""
        if q.get("default"):
            default = f" Default: {q['default']}"
        questions_text += f"- {q['id']}: {q['question']}{req}{opts}{default}\n"

    prompt = INTAKE_PROMPT.format(
        doc_title=skill.get("title", "Legal Document"),
        questions_text=questions_text,
    )

    response = llm.invoke(
        [SystemMessage(content=prompt)] + list(messages)
    )

    # Check if the LLM determined intake is complete
    try:
        parsed = json.loads(response.content)
        if parsed.get("intake_complete"):
            answers = parsed.get("answers", {})
            intake_answers.update(answers)
            return {
                "intake_complete": True,
                "intake_answers": intake_answers,
                "messages": [AIMessage(content="Thank you. I have all the information I need. Let me research the legal foundations and start drafting your document.")],
            }
    except (json.JSONDecodeError, TypeError):
        pass

    # Still gathering — return the question as a message
    return {
        "intake_complete": False,
        "messages": [response],
    }


def research_node(state: DraftingAgentState) -> dict:
    """Research legal foundations before drafting."""
    skill = state.get("skill", {})
    intake_answers = state.get("intake_answers", {})

    tools = ALL_TOOLS if state.get("web_enabled", False) else CORE_TOOLS
    llm = _get_llm()
    llm_with_tools = llm.bind_tools(tools)

    # Build intake summary
    intake_summary = "\n".join(f"- {k}: {v}" for k, v in intake_answers.items()) or "No specific requirements provided."
    statutes = ", ".join(skill.get("statutes", [])) or "General Kenyan law"

    prompt = RESEARCH_PROMPT.format(
        doc_title=skill.get("title", "Legal Document"),
        jurisdiction=skill.get("jurisdiction", "Kenya"),
        intake_summary=intake_summary,
        statutes=statutes,
    )

    step_messages = [
        SystemMessage(content=prompt),
        HumanMessage(content="Research the legal foundations for this document."),
    ]

    accumulated_citations: list[dict] = list(state.get("citations", []))

    # Tool loop
    for _round in range(MAX_TOOL_ROUNDS):
        response = llm_with_tools.invoke(step_messages)
        step_messages.append(response)

        if not response.tool_calls:
            break

        tool_msgs, new_cites = _run_tool_calls(response.tool_calls)
        accumulated_citations.extend(new_cites)
        step_messages.extend(tool_msgs)

    accumulated_citations = _dedup_citations(accumulated_citations)

    # Store research context in the last message
    research_summary = response.content if response else "No research findings."

    return {
        "citations": accumulated_citations,
        "messages": [AIMessage(content=f"[Research complete] {research_summary}")],
    }


def draft_sections_node(state: DraftingAgentState) -> dict:
    """Generate document content section by section."""
    skill = state.get("skill", {})
    intake_answers = state.get("intake_answers", {})
    citations = state.get("citations", [])

    section_defs = skill.get("sections", [])
    if not section_defs:
        return {"sections": []}

    drafting_prompt = build_drafting_prompt(skill, intake_answers)

    # Build research context from citations
    citation_ref = "\n".join(
        f"[{c.get('id')}] {c.get('title', 'Unknown')} — {c.get('snippet', '')[:200]}"
        for c in citations[:15]
    )
    research_context = citation_ref if citation_ref else "No specific research citations available — use general Kenyan legal knowledge."

    llm = _get_llm(temperature=0.15)
    sections = []

    for i, section_def in enumerate(section_defs):
        section_id = section_def.get("id", f"section_{i}")
        heading = section_def.get("heading", f"Section {i + 1}")

        topic_brief = section_def.get("topic_brief", "")
        topic_brief_block = (
            f"## Section Focus\nThis section should cover: {topic_brief}"
            if topic_brief else ""
        )

        prompt = SECTION_DRAFTER_PROMPT.format(
            drafting_prompt=drafting_prompt,
            section_heading=heading,
            section_id=section_id,
            topic_brief_block=topic_brief_block,
            research_context=research_context,
        )

        # Include previously drafted sections as full context for cross-referencing
        prev_context = ""
        if sections:
            prev_context = "\n\n## Previously Drafted Sections\n"
            for s in sections:
                prev_context += f"\n### {s['heading']}\n{s['content']}\n"

        response = llm.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"Draft the '{heading}' section now.{prev_context}"),
        ])

        sections.append({
            "id": section_id,
            "heading": heading,
            "content": response.content.strip(),
            "order": i,
            "last_edited_by": "agent",
        })

    return {
        "sections": sections,
        "messages": [AIMessage(content="I've completed the first draft of your document. You can review it in the canvas and let me know if you'd like any changes.")],
    }


def assess_node(state: DraftingAgentState) -> dict:
    """Assess each section's completeness and generate enrichment prompts."""
    skill = state.get("skill", {})
    sections = state.get("sections", [])
    intake_answers = state.get("intake_answers", {})

    if not sections:
        return {}

    llm = _get_llm(temperature=0.1)

    # Build intake summary
    intake_summary = "\n".join(f"- {k}: {v}" for k, v in intake_answers.items()) if intake_answers else "No specific intake answers provided."

    # Build sections with their context requirements and topic briefs
    section_defs = {s.get("id"): s for s in skill.get("sections", [])}
    sections_with_reqs = ""
    for s in sections:
        sid = s["id"]
        heading = s["heading"]
        content = s.get("content", "")
        skill_section = section_defs.get(sid, {})
        reqs = skill_section.get("context_requirements", [])
        topic_brief = skill_section.get("topic_brief", "")

        sections_with_reqs += f"\n### [{sid}] {heading}\n"
        if topic_brief:
            sections_with_reqs += f"Expected topics: {topic_brief}\n"
        sections_with_reqs += f"Content:\n{content}\n"
        if reqs:
            sections_with_reqs += "Context requirements:\n"
            for req in reqs:
                field = req.get("intake_field")
                desc = req.get("description", "")
                critical = req.get("critical", False)
                provided = "PROVIDED" if field and field in intake_answers else "NOT PROVIDED"
                if field is None:
                    provided = "NOT ASKED"
                sections_with_reqs += f"  - [{provided}] {'(CRITICAL) ' if critical else ''}{desc}\n"

    prompt = ASSESS_PROMPT.format(
        doc_title=skill.get("title", "Legal Document"),
        intake_summary=intake_summary,
        sections_with_requirements=sections_with_reqs,
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content="Assess each section of this document."),
    ])

    try:
        result = json.loads(response.content)
        assessments = result.get("assessments", [])

        # Merge assessments into sections
        updated_sections = list(sections)
        for assessment in assessments:
            sid = assessment.get("section_id", "")
            confidence = assessment.get("confidence", "medium")
            enrichment = assessment.get("enrichment_prompt", "")

            # Ensure the Co-Drafter: prefix is present
            if enrichment and not enrichment.startswith("Co-Drafter:"):
                enrichment = f"Co-Drafter: {enrichment}"

            topic_assessments = assessment.get("topic_assessments", [])

            for i, s in enumerate(updated_sections):
                if s["id"] == sid:
                    updated_sections[i] = {
                        **s,
                        "confidence": confidence,
                        "enrichment_prompt": enrichment,
                        "topic_assessments": topic_assessments,
                    }
                    break

        # Any sections without assessments default to medium
        for i, s in enumerate(updated_sections):
            if "confidence" not in s:
                updated_sections[i] = {
                    **s,
                    "confidence": "medium",
                    "enrichment_prompt": "Co-Drafter: This section could benefit from additional context to be more specific to your situation.",
                }

        return {"sections": updated_sections}
    except (json.JSONDecodeError, TypeError):
        log.warning("Assessment LLM did not return valid JSON — defaulting all sections to medium confidence")
        updated = [{**s, "confidence": "medium", "enrichment_prompt": ""} for s in sections]
        return {"sections": updated}


def refine_node(state: DraftingAgentState) -> dict:
    """Refine the document based on user feedback."""
    skill = state.get("skill", {})
    sections = list(state.get("sections", []))
    messages = state.get("messages", [])
    intake_answers = state.get("intake_answers", {})

    # Get the latest user message
    user_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            user_message = msg.content
            break

    if not user_message:
        return {}

    # Build conversation history from messages
    conversation_history = ""
    for msg in messages:
        if isinstance(msg, HumanMessage):
            conversation_history += f"\nUser: {msg.content}\n"
        elif isinstance(msg, AIMessage) and msg.content:
            # Truncate long AI messages but keep enough for context
            content = msg.content if len(msg.content) <= 500 else msg.content[:497] + "..."
            conversation_history += f"\nAssistant: {content}\n"

    if not conversation_history.strip():
        conversation_history = "No prior conversation."

    # Build intake summary
    intake_summary = "\n".join(f"- {k}: {v}" for k, v in intake_answers.items()) if intake_answers else "No specific intake answers recorded."

    # Build current sections summary
    current_sections = ""
    for s in sections:
        current_sections += f"\n### [{s['id']}] {s['heading']}\n{s['content']}\n"

    llm = _get_llm(temperature=0.1)

    # Build drafting instructions and quality checklist from skill
    drafting_instructions = skill.get("drafting_instructions", "")
    if not drafting_instructions:
        drafting_instructions = "Follow standard Kenyan legal drafting conventions."
    # Include statutes
    statutes = skill.get("statutes", [])
    if statutes:
        drafting_instructions = f"Applicable statutes: {', '.join(statutes)}\n\n{drafting_instructions}"

    checklist = skill.get("quality_checklist", [])
    quality_checklist = "\n".join(f"- {item}" for item in checklist) if checklist else "No specific checklist."

    prompt = REFINE_PROMPT.format(
        doc_title=skill.get("title", "Legal Document"),
        intake_summary=intake_summary,
        drafting_instructions=drafting_instructions,
        quality_checklist=quality_checklist,
        conversation_history=conversation_history,
        current_sections=current_sections,
        user_message=user_message,
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=user_message),
    ])

    # Parse updates
    try:
        result = json.loads(response.content)
        updates = result.get("updates", [])
        explanation = result.get("explanation", "")

        for update in updates:
            sid = update.get("section_id", "")
            new_content = update.get("content", "")
            new_heading = update.get("heading")  # Optional — only if user asked to rename

            for i, s in enumerate(sections):
                if s["id"] == sid:
                    # Sanitize: strip leading markdown headers that duplicate the heading
                    cleaned = _strip_leading_heading(new_content, s["heading"])
                    updated = {**s, "content": cleaned, "last_edited_by": "agent"}
                    if new_heading:
                        updated["heading"] = new_heading
                    sections[i] = updated
                    break

        return {
            "sections": sections,
            "refinement_count": state.get("refinement_count", 0) + 1,
            "messages": [AIMessage(content=explanation)],
        }
    except (json.JSONDecodeError, TypeError):
        # LLM didn't return JSON — treat as conversational response
        return {
            "messages": [response],
        }


def review_node(state: DraftingAgentState) -> dict:
    """Review the draft against the quality checklist and emit suggestions."""
    skill = state.get("skill", {})
    sections = state.get("sections", [])

    checklist = skill.get("quality_checklist", [])
    if not checklist or not sections:
        return {}

    llm = _get_llm(temperature=0.1)

    checklist_text = "\n".join(f"- {item}" for item in checklist)
    sections_text = "\n\n".join(
        f"### [{s['id']}] {s['heading']}\n{s['content']}"
        for s in sections
    )

    prompt = REVIEW_PROMPT.format(
        doc_title=skill.get("title", "Legal Document"),
        checklist=checklist_text,
        sections_text=sections_text,
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content="Review this document draft."),
    ])

    try:
        result = json.loads(response.content)
        suggestions = result.get("suggestions", [])

        # Store suggestions in sections
        if suggestions:
            updated_sections = list(sections)
            for suggestion in suggestions:
                sid = suggestion.get("section_id", "")
                comment = suggestion.get("comment", "")
                for i, s in enumerate(updated_sections):
                    if s["id"] == sid and comment:
                        updated_sections[i] = {**s, "comment": comment}
                        break

            return {"sections": updated_sections}
    except (json.JSONDecodeError, TypeError):
        pass

    return {}


# ---------- Routing ----------


def intake_router(state: DraftingAgentState) -> str:
    """After intake: complete → research, incomplete → wait for user."""
    if state.get("intake_complete", False):
        return "research"
    return END  # Pause for user response


def post_draft_router(state: DraftingAgentState) -> str:
    """After drafting: always end (user will send refinement messages)."""
    return END


# ---------- Build Graph ----------


def build_drafting_graph():
    """Build the drafting agent graph.

    Flow:
      intake → [complete? → research → draft_sections → END]
             → [not complete? → END (wait for user)]

    Refinement is handled by calling refine_node() directly, bypassing the
    graph entry point, when the user sends a message to an existing canvas thread.
    """
    graph = StateGraph(DraftingAgentState)

    graph.add_node("intake", intake_node)
    graph.add_node("research", research_node)
    graph.add_node("draft_sections", draft_sections_node)
    graph.add_node("assess", assess_node)
    graph.add_node("review", review_node)
    graph.add_node("refine", refine_node)

    graph.set_entry_point("intake")

    graph.add_conditional_edges(
        "intake",
        intake_router,
        {"research": "research", END: END},
    )

    graph.add_edge("research", "draft_sections")
    graph.add_edge("draft_sections", "assess")
    graph.add_edge("assess", "review")
    graph.add_edge("review", END)
    graph.add_edge("refine", END)

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# ---------- Singleton ----------


_drafting_agent = None


def get_drafting_agent():
    global _drafting_agent
    if _drafting_agent is None:
        _drafting_agent = build_drafting_graph()
    return _drafting_agent


# ---------- Streaming ----------


async def stream_drafting_agent(
    message: str,
    thread_id: str,
    skill_slug: str,
    skill: dict,
    web_enabled: bool = False,
    intake_answers: dict | None = None,
    existing_sections: list[dict] | None = None,
    is_refinement: bool = False,
    history: list[dict] | None = None,
):
    """Stream the drafting agent as canvas events.

    Yields dicts with type: "canvas_init" | "canvas_intake" | "canvas_section" |
                            "canvas_update" | "canvas_complete" | "token" |
                            "citations" | "status" | "done"
    """
    agent = get_drafting_agent()

    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 30}

    # Build message history
    input_messages: list[BaseMessage] = []
    if history:
        for h in history[-10:]:
            if h["role"] == "user":
                input_messages.append(HumanMessage(content=h["content"]))
            elif h["role"] == "assistant":
                content = h["content"]
                if len(content) > 1000:
                    content = content[:997] + "..."
                input_messages.append(AIMessage(content=content))
    input_messages.append(HumanMessage(content=message))

    # Emit canvas initialization
    if not is_refinement:
        yield {
            "type": "canvas_init",
            "doc_type": skill.get("doc_type", ""),
            "doc_title": skill.get("title", "Legal Document"),
            "skill_slug": skill_slug,
            "sections": [
                {"id": s["id"], "heading": s["heading"]}
                for s in skill.get("sections", [])
            ],
        }

    accumulated_citations: list[dict] = []

    # ── Refinement: call refine_node() directly, bypassing the graph ──
    if is_refinement and existing_sections:
        yield {"type": "status", "phase": "refining", "message": "Updating your document..."}

        refine_state = {
            "messages": input_messages,
            "skill": skill,
            "skill_slug": skill_slug,
            "doc_type": skill.get("doc_type", ""),
            "sections": existing_sections,
            "intake_answers": intake_answers or {},
            "intake_complete": True,
            "citations": [],
            "web_enabled": web_enabled,
            "current_section_idx": 0,
            "refinement_count": 0,
            "canvas_id": "",
        }

        try:
            # Call refine_node directly — no graph traversal, no intake re-entry
            result = refine_node(refine_state)

            # Check for section updates (content or heading changes)
            new_sections = result.get("sections", existing_sections)
            if new_sections and new_sections != existing_sections:
                for section in new_sections:
                    for old_section in existing_sections:
                        if section["id"] == old_section["id"] and (
                            section["content"] != old_section["content"]
                            or section.get("heading") != old_section.get("heading")
                        ):
                            yield {
                                "type": "canvas_update",
                                "section_id": section["id"],
                                "heading": section["heading"],
                                "content": section["content"],
                            }

            # Emit explanation
            for msg in result.get("messages", []):
                if hasattr(msg, "content") and msg.content:
                    yield {"type": "token", "content": msg.content}

            # Re-assess all sections after refinement
            final_sections = new_sections or existing_sections
            try:
                yield {"type": "status", "phase": "assessing", "message": "Re-evaluating document completeness..."}
                assess_state = {
                    "skill": skill,
                    "sections": final_sections,
                    "intake_answers": intake_answers or {},
                }
                assess_result = assess_node(assess_state)
                assessed_sections = assess_result.get("sections", final_sections)

                final_sections = assessed_sections
            except Exception as assess_err:
                log.warning(f"Post-refinement assessment failed (non-fatal): {assess_err}")
                import traceback
                traceback.print_exc()

            # Emit per-section assessment events (from new assessment or carried over)
            for section in final_sections:
                confidence = section.get("confidence")
                enrichment = section.get("enrichment_prompt")
                if confidence:
                    yield {
                        "type": "canvas_assessment",
                        "section_id": section["id"],
                        "confidence": confidence,
                        "enrichment_prompt": enrichment or "",
                        "topic_assessments": section.get("topic_assessments", []),
                    }

            yield {
                "type": "canvas_complete",
                "sections": final_sections,
                "version": (result.get("refinement_count", 0) + 1),
            }

        except Exception as e:
            log.error(f"Refinement failed: {e}")
            import traceback
            traceback.print_exc()
            yield {"type": "token", "content": f"I encountered an error updating the document: {str(e)}"}

        yield {"type": "done", "thread_id": thread_id, "citations": []}
        return

    # ── Full drafting flow: intake → research → draft ──
    input_state = {
        "messages": input_messages,
        "skill": skill,
        "skill_slug": skill_slug,
        "doc_type": skill.get("doc_type", ""),
        "intake_answers": intake_answers or {},
        "intake_complete": bool(intake_answers),
        "citations": [],
        "web_enabled": web_enabled,
        "sections": [],
        "current_section_idx": 0,
        "refinement_count": 0,
        "canvas_id": "",
    }

    try:
        async for event in agent.astream_events(
            input_state,
            config=config,
            version="v2",
        ):
            kind = event.get("event", "")
            name = event.get("name", "")

            # Track phase changes
            if kind == "on_chain_start":
                if name == "intake":
                    yield {"type": "status", "phase": "intake", "message": "Gathering document requirements..."}
                elif name == "research":
                    yield {"type": "status", "phase": "researching", "message": "Researching legal foundations..."}
                elif name == "draft_sections":
                    yield {"type": "status", "phase": "drafting", "message": "Drafting your document..."}
                elif name == "assess":
                    yield {"type": "status", "phase": "assessing", "message": "Evaluating document completeness..."}

            # Stream intake questions
            if kind == "on_chain_end" and name == "intake":
                output = event.get("data", {}).get("output", {})
                if isinstance(output, dict):
                    if not output.get("intake_complete", False):
                        msgs = output.get("messages", [])
                        for msg in msgs:
                            if hasattr(msg, "content") and msg.content:
                                yield {"type": "token", "content": msg.content}
                    else:
                        # Intake complete — emit intake answers
                        yield {
                            "type": "canvas_intake",
                            "answers": output.get("intake_answers", {}),
                        }

            # Stream research progress
            elif kind == "on_chat_model_stream" and name in ("research",):
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    pass  # Don't stream research internals to user

            # Capture section generation completion
            elif kind == "on_chain_end" and name == "draft_sections":
                output = event.get("data", {}).get("output", {})
                if isinstance(output, dict):
                    sections = output.get("sections", [])
                    for section in sections:
                        yield {
                            "type": "canvas_section",
                            "section_id": section["id"],
                            "heading": section["heading"],
                            "content": section["content"],
                            "order": section.get("order", 0),
                        }

                    # Emit canvas complete
                    yield {
                        "type": "canvas_complete",
                        "sections": sections,
                        "version": 1,
                        "word_count": sum(len(s.get("content", "").split()) for s in sections),
                    }

                    # Emit the agent's completion message
                    msgs = output.get("messages", [])
                    for msg in msgs:
                        if hasattr(msg, "content") and msg.content:
                            yield {"type": "token", "content": msg.content}

            # Capture assessment results
            elif kind == "on_chain_end" and name == "assess":
                output = event.get("data", {}).get("output", {})
                if isinstance(output, dict):
                    assessed_sections = output.get("sections", [])
                    for section in assessed_sections:
                        confidence = section.get("confidence")
                        enrichment = section.get("enrichment_prompt")
                        if confidence:
                            yield {
                                "type": "canvas_assessment",
                                "section_id": section["id"],
                                "confidence": confidence,
                                "enrichment_prompt": enrichment or "",
                                "topic_assessments": section.get("topic_assessments", []),
                            }

            # Capture review suggestions
            elif kind == "on_chain_end" and name == "review":
                output = event.get("data", {}).get("output", {})
                if isinstance(output, dict):
                    review_sections = output.get("sections", [])
                    for section in review_sections:
                        comment = section.get("comment", "")
                        if comment:
                            yield {
                                "type": "canvas_comment",
                                "section_id": section["id"],
                                "comment": comment,
                            }

            # Collect citations from tool outputs
            elif kind == "on_tool_end":
                output = event.get("data", {}).get("output", "")
                try:
                    parsed = json.loads(output) if isinstance(output, str) else output
                    if isinstance(parsed, dict) and "citations" in parsed:
                        accumulated_citations.extend(parsed["citations"])
                except (json.JSONDecodeError, TypeError):
                    pass

    except Exception as e:
        import traceback
        traceback.print_exc()
        yield {"type": "token", "content": f"\n\nSorry, an error occurred during document drafting: {str(e)}"}

    # Deduplicate citations
    accumulated_citations = _dedup_citations(accumulated_citations)

    if accumulated_citations:
        yield {"type": "citations", "citations": accumulated_citations}

    yield {
        "type": "done",
        "thread_id": thread_id,
        "citations": accumulated_citations,
    }
