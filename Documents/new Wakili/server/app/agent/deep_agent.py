"""Lawlyfy Deep Research Agent — multi-node graph with planning, synthesis, and verification.

Architecture:
  plan → step_executor → [more steps? → step_executor | synthesize] → verify → END

Each step_executor runs its own internal tool loop (no graph-level tool recursion).
This keeps graph hops linear: plan(1) + steps(N) + synthesize(1) + verify(1) = N+3 hops.
"""

from __future__ import annotations

from typing import Annotated, Any, Sequence
import json
import logging
import uuid

from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import TypedDict

from app.config import settings
from app.agent.tools.rag_vector import search_vector_db
from app.agent.tools.rag_graph import query_knowledge_graph
from app.agent.tools.web_search import web_search
from app.agent.tools.documents import create_document
from app.agent.legal_agent import _dedup_citations

log = logging.getLogger(__name__)


# ---------- State ----------


class DeepAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    citations: list[dict[str, Any]]
    web_enabled: bool
    plan: list[str]
    current_step: int
    research_notes: list[str]
    verification_status: str  # "pending" | "passed" | "needs_revision"
    iteration_count: int
    final_answer: str


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


CORE_TOOLS = [search_vector_db, query_knowledge_graph, create_document]
ALL_TOOLS = CORE_TOOLS + [web_search]
TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}

MAX_TOOL_ROUNDS = 3  # Max tool call rounds per research step


def _run_tool_calls(tool_calls: list[dict]) -> tuple[list[ToolMessage], list[dict]]:
    """Execute tool calls synchronously. Returns (tool_messages, new_citations)."""
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


PLANNER_PROMPT = """You are a legal research planning expert. Given a legal question, decompose it into a clear research plan.

Each step should be a specific, actionable research task. Think about:
1. What legal concepts need to be defined?
2. What statutes or regulations are relevant?
3. What case law needs to be found?
4. Are there cross-jurisdictional comparisons needed?

Respond with ONLY a JSON array of strings, each being one research step. Example:
["Search for the statutory definition of 'unfair dismissal' under the Employment Act",
 "Find leading Court of Appeal cases interpreting unfair dismissal provisions",
 "Check if any found cases have been overruled or distinguished"]

Keep it to exactly 3 steps. Be specific to the legal question asked."""

SYNTHESIZER_PROMPT = """You are Lawlyfy AI, an expert legal research assistant performing deep research.

You have completed a multi-step research plan. Below are the research findings from each step.

Synthesize all findings into a comprehensive, well-structured legal analysis.

## Rules
1. **Citation-First**: Every legal claim MUST use [n] notation matching citation IDs.
2. **Structure**: Use clear headings and logical flow.
3. **Completeness**: Address every aspect of the original question.
4. **Jurisdictional Awareness**: Note jurisdictions. Don't conflate different jurisdictions.
5. **Practical Value**: End with practical implications or conclusions.

## Format
- Start with an executive summary (2-3 sentences)
- Then structured analysis with headings
- Reference all relevant citations using [n]
- End with a conclusion and any caveats

You are NOT providing legal advice — you are a research tool. Flag when case law may have been overruled."""

VERIFIER_PROMPT = """You are a legal research quality reviewer. Evaluate the research answer against the original question.

Check for:
1. **Completeness**: Does it address all parts of the question?
2. **Citation Support**: Are major claims backed by [n] citations?
3. **Jurisdictional Clarity**: Are jurisdictions clearly noted?
4. **Logical Flow**: Is the reasoning coherent?

Respond with EXACTLY this JSON:
{"status": "passed", "score": 8, "issues": []}

Only use "needs_revision" if the answer is fundamentally flawed (missing entire topics, no citations at all).
A score of 6+ should be "passed". Be practical, not perfectionist."""


# ---------- Nodes ----------


def plan_node(state: DeepAgentState) -> dict:
    """Analyze the question and create a research plan."""
    llm = _get_llm(temperature=0.2)

    user_question = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_question = msg.content
            break

    response = llm.invoke([
        SystemMessage(content=PLANNER_PROMPT),
        HumanMessage(content=f"Create a research plan for:\n\n{user_question}"),
    ])

    try:
        plan = json.loads(response.content)
        if not isinstance(plan, list):
            plan = [response.content]
    except json.JSONDecodeError:
        lines = [l.strip().lstrip("0123456789.-) ") for l in response.content.split("\n") if l.strip()]
        plan = lines[:3] if lines else ["Research the legal question comprehensively"]

    # Hard cap at 3 steps
    plan = plan[:3]

    log.info(f"Deep research plan ({len(plan)} steps): {plan}")

    return {
        "plan": plan,
        "current_step": 0,
        "research_notes": [],
        "verification_status": "pending",
    }


def step_executor_node(state: DeepAgentState) -> dict:
    """Execute a single research step with its own internal tool loop.

    This node is self-contained: it calls the LLM, executes any tool calls,
    feeds results back to the LLM, and repeats until the LLM responds with
    text (no more tool calls) or we hit MAX_TOOL_ROUNDS.

    Returns a research note summary and any accumulated citations.
    """
    plan = state.get("plan", [])
    step_idx = state.get("current_step", 0)

    if step_idx >= len(plan):
        return {"current_step": step_idx + 1}

    current_task = plan[step_idx]

    user_question = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_question = msg.content
            break

    # Build context from previous research notes
    prev_notes = state.get("research_notes", [])
    context = ""
    if prev_notes:
        context = "\n\nPrevious findings:\n" + "\n".join(f"- {n}" for n in prev_notes)

    tools = ALL_TOOLS if state.get("web_enabled", False) else CORE_TOOLS
    llm = _get_llm()
    llm_with_tools = llm.bind_tools(tools)

    # Start the internal conversation for this step
    step_messages = [
        SystemMessage(content=f"""You are a legal researcher executing one step of a research plan.

Original question: {user_question}
Current task (step {step_idx + 1}): {current_task}
{context}

Call the appropriate tools to execute this step. Once you have enough results, provide a summary of your findings. Do NOT call tools more than twice."""),
        HumanMessage(content=f"Execute: {current_task}"),
    ]

    accumulated_citations: list[dict] = list(state.get("citations", []))
    step_content = ""

    # Internal tool loop (max rounds to prevent runaway)
    for _round in range(MAX_TOOL_ROUNDS):
        response = llm_with_tools.invoke(step_messages)
        step_messages.append(response)

        # If no tool calls, the LLM is done with this step
        if not response.tool_calls:
            step_content = response.content
            break

        # Execute tool calls
        tool_msgs, new_cites = _run_tool_calls(response.tool_calls)
        accumulated_citations.extend(new_cites)
        step_messages.extend(tool_msgs)
    else:
        # Hit max rounds — ask LLM to summarize what it has
        summary_resp = llm.invoke(step_messages + [
            HumanMessage(content="Summarize your findings for this step in 2-3 sentences."),
        ])
        step_content = summary_resp.content

    # Deduplicate citations
    accumulated_citations = _dedup_citations(accumulated_citations)

    # Build the research note
    note = f"Step {step_idx + 1} — {current_task}: {step_content}"

    notes = list(state.get("research_notes", []))
    notes.append(note)

    log.info(f"Deep research step {step_idx + 1}/{len(plan)} complete: {current_task[:60]}...")

    return {
        "current_step": step_idx + 1,
        "research_notes": notes,
        "citations": accumulated_citations,
        "messages": [AIMessage(content=f"[Step {step_idx + 1} complete] {step_content}")],
    }


def synthesize_node(state: DeepAgentState) -> dict:
    """Combine all research into a comprehensive answer."""
    llm = _get_llm(temperature=0.15)

    user_question = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_question = msg.content
            break

    notes = state.get("research_notes", [])
    citations = state.get("citations", [])

    citation_ref = "\n".join(
        f"[{c.get('id')}] {c.get('title', 'Unknown')} ({c.get('court', '')}, {c.get('year', '')})"
        for c in citations
    )

    synthesis_input = f"""Original question: {user_question}

Research findings:
{chr(10).join(notes)}

Available citations (use [n] to reference):
{citation_ref if citation_ref else "(No citations found — note this in your response)"}

Synthesize a comprehensive legal analysis addressing the original question."""

    response = llm.invoke([
        SystemMessage(content=SYNTHESIZER_PROMPT),
        HumanMessage(content=synthesis_input),
    ])

    return {
        "final_answer": response.content,
        "messages": [response],
    }


def verify_node(state: DeepAgentState) -> dict:
    """Verify the quality of the synthesized answer."""
    llm = _get_llm(temperature=0.0)

    user_question = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_question = msg.content
            break

    answer = state.get("final_answer", "")
    citations = state.get("citations", [])

    response = llm.invoke([
        SystemMessage(content=VERIFIER_PROMPT),
        HumanMessage(content=f"Question: {user_question}\n\nAnswer:\n{answer}\n\nCitations: {len(citations)}"),
    ])

    try:
        result = json.loads(response.content)
        status = result.get("status", "passed")
    except json.JSONDecodeError:
        status = "passed"

    iteration = state.get("iteration_count", 0) + 1

    # Force pass after 1 revision attempt
    if iteration >= 2:
        status = "passed"

    log.info(f"Deep research verification: {status} (iteration {iteration})")

    return {
        "verification_status": status,
        "iteration_count": iteration,
    }


# ---------- Routing ----------


def has_more_steps(state: DeepAgentState) -> str:
    """After step execution: are there more plan steps?"""
    step_idx = state.get("current_step", 0)
    plan = state.get("plan", [])
    if step_idx < len(plan):
        return "execute_step"
    return "synthesize"


def verification_result(state: DeepAgentState) -> str:
    """After verification: passed or needs revision?"""
    if state.get("verification_status") == "needs_revision":
        return "revise"
    return "done"


# ---------- Build Graph ----------


def build_deep_agent_graph():
    """Build the deep research graph.

    Linear flow with no graph-level tool loops:
      plan → step_executor → [more steps? → step_executor | synthesize] → verify → [done | revise→synthesize]

    Total graph hops: plan(1) + steps(3) + synthesize(1) + verify(1) = 6 hops typical.
    Max with 1 revision: 6 + synthesize(1) + verify(1) = 8 hops.
    """
    graph = StateGraph(DeepAgentState)

    graph.add_node("plan", plan_node)
    graph.add_node("execute_step", step_executor_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("verify", verify_node)

    graph.set_entry_point("plan")

    # plan → first step execution
    graph.add_edge("plan", "execute_step")

    # step done → more steps or synthesize
    graph.add_conditional_edges(
        "execute_step",
        has_more_steps,
        {"execute_step": "execute_step", "synthesize": "synthesize"},
    )

    # synthesize → verify
    graph.add_edge("synthesize", "verify")

    # verify → done or revise (re-synthesize with same data)
    graph.add_conditional_edges(
        "verify",
        verification_result,
        {"done": END, "revise": "synthesize"},
    )

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# ---------- Singleton ----------


_deep_agent = None


def get_deep_agent():
    global _deep_agent
    if _deep_agent is None:
        _deep_agent = build_deep_agent_graph()
    return _deep_agent


# ---------- Invocation ----------


async def stream_deep_agent(
    message: str,
    thread_id: str = "",
    web_enabled: bool = False,
):
    """Stream the deep research agent as events.

    Yields dicts with type: "token" | "citations" | "status" | "done"
    """
    agent = get_deep_agent()

    if not thread_id:
        thread_id = uuid.uuid4().hex

    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 50}

    accumulated_citations: list[dict] = []
    current_phase = "planning"

    yield {"type": "status", "phase": "planning", "message": "Creating research plan..."}

    try:
        async for event in agent.astream_events(
            {
                "messages": [HumanMessage(content=message)],
                "web_enabled": web_enabled,
                "citations": [],
                "plan": [],
                "current_step": 0,
                "research_notes": [],
                "verification_status": "pending",
                "iteration_count": 0,
                "final_answer": "",
            },
            config=config,
            version="v2",
        ):
            kind = event.get("event", "")
            name = event.get("name", "")

            # Track phase changes via node names
            if kind == "on_chain_start":
                if name == "plan":
                    current_phase = "planning"
                    yield {"type": "status", "phase": "planning", "message": "Creating research plan..."}
                elif name == "execute_step":
                    current_phase = "researching"
                    yield {"type": "status", "phase": "researching", "message": "Executing research step..."}
                elif name == "synthesize":
                    current_phase = "synthesizing"
                    yield {"type": "status", "phase": "synthesizing", "message": "Synthesizing findings..."}
                elif name == "verify":
                    current_phase = "verifying"
                    yield {"type": "status", "phase": "verifying", "message": "Verifying quality..."}

            # Stream tokens from the synthesize node (the final answer)
            if kind == "on_chat_model_stream" and current_phase == "synthesizing":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield {"type": "token", "content": chunk.content}

            # Collect citations from tool outputs (inside step_executor)
            elif kind == "on_tool_end":
                output = event.get("data", {}).get("output", "")
                try:
                    parsed = json.loads(output) if isinstance(output, str) else output
                    if isinstance(parsed, dict) and "citations" in parsed:
                        for cite in parsed["citations"]:
                            accumulated_citations.append(cite)
                except (json.JSONDecodeError, TypeError):
                    pass

    except Exception as e:
        import traceback
        traceback.print_exc()
        yield {"type": "token", "content": f"\n\nSorry, an error occurred during deep research: {str(e)}"}

    # Deduplicate and re-number
    accumulated_citations = _dedup_citations(accumulated_citations)

    if accumulated_citations:
        yield {"type": "citations", "citations": accumulated_citations}

    yield {
        "type": "done",
        "citations": accumulated_citations,
        "thread_id": thread_id,
    }
