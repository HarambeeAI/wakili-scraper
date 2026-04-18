import { StateGraph } from "@langchain/langgraph";
import { CalendarAgentState } from "./calendar-state";
import { askCalendarQuestions } from "./nodes/ask-calendar-questions";
import { generateCalendar } from "./nodes/generate-calendar";
import { presentCalendar } from "./nodes/present-calendar";
import { generateContentBatch } from "./nodes/generate-content-batch";

export function createCalendarGraph() {
  const graph = new StateGraph(CalendarAgentState)
    .addNode("ask_calendar_questions", askCalendarQuestions)
    .addNode("generate_calendar", generateCalendar)
    .addNode("present_calendar", presentCalendar)
    .addNode("generate_content_batch", generateContentBatch)
    .addEdge("__start__", "ask_calendar_questions")
    .addEdge("ask_calendar_questions", "generate_calendar")
    .addEdge("generate_calendar", "present_calendar")
    .addEdge("present_calendar", "generate_content_batch");

  return graph.compile();
}
