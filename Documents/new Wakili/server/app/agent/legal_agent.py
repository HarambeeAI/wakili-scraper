"""Lawlyfy legal research agent assembly (standard mode)."""

from __future__ import annotations

from typing import Annotated, Any, Sequence
import json
import uuid

from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import TypedDict

from app.config import settings
from app.agent.prompts import LEGAL_RESEARCH_SYSTEM_PROMPT
from app.agent.tools.rag_vector import search_vector_db
from app.agent.tools.rag_graph import query_knowledge_graph
from app.agent.tools.web_search import web_search
from app.agent.tools.documents import create_document
from app.agent.state import Citation


# --- Agent State ---

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    citations: list[dict[str, Any]]
    web_enabled: bool


# --- LLM ---

def get_llm():
    return ChatOpenAI(
        model=settings.LLM_MODEL,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
        temperature=0.1,
        streaming=True,
    )


# --- Agent Node ---

CORE_TOOLS = [search_vector_db, query_knowledge_graph, create_document]
ALL_TOOLS = CORE_TOOLS + [web_search]

TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}


def agent_node(state: AgentState) -> dict:
    """Main agent reasoning node."""
    llm = get_llm()

    if state.get("web_enabled", False):
        tools = ALL_TOOLS
    else:
        tools = CORE_TOOLS

    llm_with_tools = llm.bind_tools(tools)

    messages = list(state["messages"])
    if not messages or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=LEGAL_RESEARCH_SYSTEM_PROMPT)] + messages

    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


def _dedup_citations(citations: list[dict]) -> list[dict]:
    """Remove duplicate citations by source_doc_id, keeping highest relevance."""
    seen: dict[str, dict] = {}
    for cite in citations:
        key = cite.get("source_doc_id") or cite.get("title", "")
        if not key:
            seen[cite.get("id", str(len(seen)))] = cite
            continue
        existing = seen.get(key)
        if existing is None or cite.get("relevance", 0) > existing.get("relevance", 0):
            seen[key] = cite
    # Re-number after dedup
    deduped = list(seen.values())
    for i, cite in enumerate(deduped):
        cite["id"] = str(i + 1)
    return deduped


def tool_node(state: AgentState) -> dict:
    """Execute tool calls from the last AI message."""
    last_message = state["messages"][-1]
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

        # Extract citations from tool results
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

    # Deduplicate and re-number globally
    accumulated_citations = _dedup_citations(accumulated_citations)

    return {"messages": results, "citations": accumulated_citations}


def should_continue(state: AgentState) -> str:
    """Determine if the agent should continue (has tool calls) or finish."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"


# --- Build Graph ---

def build_agent_graph():
    """Construct the LangGraph agent graph."""
    graph = StateGraph(AgentState)

    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)

    graph.set_entry_point("agent")

    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "end": END},
    )

    graph.add_edge("tools", "agent")

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# --- Singleton ---

_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent_graph()
    return _agent


def invoke_agent(
    message: str,
    thread_id: str = "",
    web_enabled: bool = False,
) -> dict:
    """Invoke the agent synchronously."""
    agent = get_agent()

    if not thread_id:
        thread_id = uuid.uuid4().hex

    config = {"configurable": {"thread_id": thread_id}}

    result = agent.invoke(
        {
            "messages": [HumanMessage(content=message)],
            "web_enabled": web_enabled,
            "citations": [],
        },
        config=config,
    )

    ai_messages = [m for m in result["messages"] if isinstance(m, AIMessage)]
    last_ai = ai_messages[-1] if ai_messages else None

    return {
        "content": last_ai.content if last_ai else "",
        "citations": result.get("citations", []),
        "thread_id": thread_id,
    }


async def stream_agent(
    message: str,
    thread_id: str = "",
    web_enabled: bool = False,
):
    """Stream the agent response as events.

    Yields dicts with type: "token" | "citations" | "done"
    """
    agent = get_agent()

    if not thread_id:
        thread_id = uuid.uuid4().hex

    config = {"configurable": {"thread_id": thread_id}}

    accumulated_citations: list[dict] = []

    try:
        async for event in agent.astream_events(
            {
                "messages": [HumanMessage(content=message)],
                "web_enabled": web_enabled,
                "citations": [],
            },
            config=config,
            version="v2",
        ):
            kind = event.get("event", "")

            if kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield {"type": "token", "content": chunk.content}

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
        yield {"type": "token", "content": f"\n\nSorry, an error occurred during research: {str(e)}"}

    # Deduplicate and re-number before sending final citations
    accumulated_citations = _dedup_citations(accumulated_citations)

    yield {
        "type": "done",
        "citations": accumulated_citations,
        "thread_id": thread_id,
    }
