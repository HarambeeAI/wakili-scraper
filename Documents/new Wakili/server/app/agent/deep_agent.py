"""Lawlyfy Deep Research Agent — multi-node graph with planning, synthesis, and verification."""

from __future__ import annotations

from typing import Annotated, Any, Sequence
import json
import logging
import uuid

from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
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

MAX_ITERATIONS = 3  # Max planner→research→verify loops


# ---------- State ----------


class DeepAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    citations: list[dict[str, Any]]
    web_enabled: bool
    # Deep research additions
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


# ---------- Prompts ----------


PLANNER_PROMPT = """You are a legal research planning expert. Given a legal question, decompose it into a clear, numbered research plan.

Each step should be a specific, actionable research task. Think about:
1. What legal concepts need to be defined?
2. What statutes or regulations are relevant?
3. What case law needs to be found?
4. Are there cross-jurisdictional comparisons needed?
5. Are there recent developments to check?

Respond with ONLY a JSON array of strings, each being one research step. Example:
["Search for the statutory definition of 'unfair dismissal' under the Employment Act",
 "Find leading Court of Appeal cases on unfair dismissal in the last 5 years",
 "Check if any of the found cases have been overruled or distinguished"]

Keep it to 3-4 steps maximum. Be specific to the legal question asked."""

SYNTHESIZER_PROMPT = """You are Lawlyfy AI, an expert legal research assistant performing deep research.

You have completed a multi-step research plan. Below are the research findings from each step.

Your task: Synthesize all findings into a comprehensive, well-structured legal analysis.

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

VERIFIER_PROMPT = """You are a legal research quality reviewer. Evaluate the following research answer against the original question.

Check for:
1. **Completeness**: Does the answer address all parts of the question?
2. **Citation Support**: Are all major claims backed by [n] citations?
3. **Accuracy Signals**: Are there unsupported assertions or potential hallucinations?
4. **Jurisdictional Clarity**: Are jurisdictions clearly noted?
5. **Logical Flow**: Is the reasoning coherent?

Respond with EXACTLY this JSON format:
{
    "status": "passed" or "needs_revision",
    "issues": ["list of specific issues found, if any"],
    "score": 1-10
}

Be strict. A score below 7 should be "needs_revision"."""


# ---------- Nodes ----------


def plan_node(state: DeepAgentState) -> dict:
    """Analyze the question and create a research plan."""
    llm = _get_llm(temperature=0.2)

    # Get the user's question from the last human message
    user_question = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_question = msg.content
            break

    response = llm.invoke([
        SystemMessage(content=PLANNER_PROMPT),
        HumanMessage(content=f"Create a research plan for this legal question:\n\n{user_question}"),
    ])

    # Parse the plan
    try:
        plan = json.loads(response.content)
        if not isinstance(plan, list):
            plan = [response.content]
    except json.JSONDecodeError:
        # If LLM didn't return valid JSON, treat the whole response as one step
        lines = [l.strip() for l in response.content.split("\n") if l.strip()]
        plan = lines if lines else ["Research the legal question comprehensively"]

    return {
        "plan": plan,
        "current_step": 0,
        "research_notes": [],
        "verification_status": "pending",
    }


def research_node(state: DeepAgentState) -> dict:
    """Execute the current research step using tools."""
    llm = _get_llm()
    plan = state.get("plan", [])
    step_idx = state.get("current_step", 0)

    if step_idx >= len(plan):
        # All steps done
        return {}

    current_task = plan[step_idx]

    # Get user's original question
    user_question = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_question = msg.content
            break

    # Build context from previous research notes
    prev_notes = state.get("research_notes", [])
    context = ""
    if prev_notes:
        context = "\n\nPrevious research findings:\n" + "\n".join(f"- {n}" for n in prev_notes)

    # Determine available tools
    if state.get("web_enabled", False):
        tools = ALL_TOOLS
    else:
        tools = CORE_TOOLS

    llm_with_tools = llm.bind_tools(tools)

    research_prompt = f"""You are a legal researcher executing step {step_idx + 1} of a research plan.

Original question: {user_question}

Current task: {current_task}
{context}

Execute this research step by calling the appropriate tools. After getting results, provide a brief summary of your findings for this step."""

    response = llm_with_tools.invoke([
        SystemMessage(content=research_prompt),
        HumanMessage(content=f"Execute research step: {current_task}"),
    ])

    return {"messages": [response]}


def tool_exec_node(state: DeepAgentState) -> dict:
    """Execute tool calls and accumulate citations."""
    last_message = state["messages"][-1]

    if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
        return {}

    results = []
    accumulated_citations: list[dict] = list(state.get("citations", []))

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        tool_fn = TOOLS_BY_NAME.get(tool_name)
        if tool_fn is None:
            result_content = json.dumps({"error": f"Unknown tool: {tool_name}"})
        else:
            result_content = tool_fn.invoke(tool_args)

        try:
            parsed = json.loads(result_content)
            if "citations" in parsed:
                for cite in parsed["citations"]:
                    accumulated_citations.append(cite)
        except (json.JSONDecodeError, TypeError):
            pass

        from langchain_core.messages import ToolMessage
        results.append(
            ToolMessage(content=result_content, tool_call_id=tool_call["id"])
        )

    accumulated_citations = _dedup_citations(accumulated_citations)

    return {"messages": results, "citations": accumulated_citations}


def collect_note_node(state: DeepAgentState) -> dict:
    """After tool results, have LLM summarize findings and advance to next step."""
    llm = _get_llm()

    plan = state.get("plan", [])
    step_idx = state.get("current_step", 0)
    current_task = plan[step_idx] if step_idx < len(plan) else "research"

    # Get the last few messages (tool results)
    recent_messages = list(state["messages"])[-6:]  # Last few for context

    response = llm.invoke([
        SystemMessage(content=f"Summarize the research findings for this step in 2-3 sentences. Step: {current_task}"),
        *recent_messages,
    ])

    notes = list(state.get("research_notes", []))
    notes.append(f"Step {step_idx + 1} ({current_task}): {response.content}")

    return {
        "research_notes": notes,
        "current_step": step_idx + 1,
        "messages": [response],
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

    # Build citation reference for the LLM
    citation_ref = "\n".join(
        f"[{c.get('id')}] {c.get('title', 'Unknown')} ({c.get('court', '')}, {c.get('year', '')})"
        for c in citations
    )

    synthesis_input = f"""Original question: {user_question}

Research findings:
{chr(10).join(notes)}

Available citations (use [n] to reference):
{citation_ref}

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

    verify_input = f"""Original question: {user_question}

Answer to verify:
{answer}

Citations available: {len(citations)}

Evaluate this answer."""

    response = llm.invoke([
        SystemMessage(content=VERIFIER_PROMPT),
        HumanMessage(content=verify_input),
    ])

    try:
        result = json.loads(response.content)
        status = result.get("status", "passed")
        score = result.get("score", 7)
    except json.JSONDecodeError:
        status = "passed"
        score = 7

    iteration = state.get("iteration_count", 0) + 1

    # Force pass after max iterations to prevent infinite loops
    if iteration >= MAX_ITERATIONS:
        status = "passed"

    return {
        "verification_status": status,
        "iteration_count": iteration,
    }


# ---------- Routing ----------


def should_research_continue(state: DeepAgentState) -> str:
    """After research node: does the LLM want to call tools, or move on?"""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "collect"


def has_more_steps(state: DeepAgentState) -> str:
    """After collecting a note: are there more plan steps?"""
    step_idx = state.get("current_step", 0)
    plan = state.get("plan", [])
    if step_idx < len(plan):
        return "research"
    return "synthesize"


def verification_result(state: DeepAgentState) -> str:
    """After verification: passed or needs revision?"""
    if state.get("verification_status") == "needs_revision":
        return "revise"
    return "done"


# ---------- Build Graph ----------


def build_deep_agent_graph():
    """Build the deep research multi-node graph.

    Flow:
    plan → research → [tools → research loop] → collect_note → [more steps? → research | synthesize]
    synthesize → verify → [passed? → done | needs_revision? → research step 0 again]
    """
    graph = StateGraph(DeepAgentState)

    graph.add_node("plan", plan_node)
    graph.add_node("research", research_node)
    graph.add_node("tools", tool_exec_node)
    graph.add_node("collect_note", collect_note_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("verify", verify_node)

    graph.set_entry_point("plan")

    # plan → research
    graph.add_edge("plan", "research")

    # research → tools (if tool calls) or collect_note (if done)
    graph.add_conditional_edges(
        "research",
        should_research_continue,
        {"tools": "tools", "collect": "collect_note"},
    )

    # tools → research (loop back for LLM to process results)
    graph.add_edge("tools", "research")

    # collect_note → research (more steps) or synthesize (done)
    graph.add_conditional_edges(
        "collect_note",
        has_more_steps,
        {"research": "research", "synthesize": "synthesize"},
    )

    # synthesize → verify
    graph.add_edge("synthesize", "verify")

    # verify → done or revise
    graph.add_conditional_edges(
        "verify",
        verification_result,
        {"done": END, "revise": "research"},
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

    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 100}

    accumulated_citations: list[dict] = []
    current_phase = "planning"

    # Emit initial status
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

            # Track phase changes
            if kind == "on_chain_start":
                if name == "plan":
                    current_phase = "planning"
                    yield {"type": "status", "phase": "planning", "message": "Creating research plan..."}
                elif name == "research":
                    current_phase = "researching"
                    yield {"type": "status", "phase": "researching", "message": "Researching..."}
                elif name == "synthesize":
                    current_phase = "synthesizing"
                    yield {"type": "status", "phase": "synthesizing", "message": "Synthesizing findings..."}
                elif name == "verify":
                    current_phase = "verifying"
                    yield {"type": "status", "phase": "verifying", "message": "Verifying quality..."}

            # Stream tokens only from the synthesize node (final answer)
            if kind == "on_chat_model_stream" and current_phase == "synthesizing":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield {"type": "token", "content": chunk.content}

            # Collect citations from tool outputs
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

    # Emit citations batch
    if accumulated_citations:
        yield {"type": "citations", "citations": accumulated_citations}

    yield {
        "type": "done",
        "citations": accumulated_citations,
        "thread_id": thread_id,
    }
