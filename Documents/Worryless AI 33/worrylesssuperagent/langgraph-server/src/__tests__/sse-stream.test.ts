import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Mocks (must be declared before imports that use them) ────────────────────

const mockCheckpointer = {};

const mockGetState = vi.fn().mockResolvedValue({
  values: {
    uiComponents: [],
    pendingApprovals: [],
    responseMetadata: {
      agentType: "chief_of_staff",
      agentDisplayName: "Chief of Staff",
    },
  },
});

// Async generator that yields AIMessage then a metadata chunk, then ends
async function* mockStreamGenerator() {
  const { AIMessage } = await import("@langchain/core/messages");
  yield [new AIMessage("Hello"), { langgraph_node: "cosTools" }];
}

const mockGraph = {
  stream: vi.fn().mockImplementation(() => mockStreamGenerator()),
  getState: mockGetState,
};

vi.mock("../persistence/checkpointer.js", () => ({
  getCheckpointer: vi.fn().mockResolvedValue(mockCheckpointer),
}));

vi.mock("../graph/supervisor.js", () => ({
  createSupervisorGraph: vi.fn().mockReturnValue(mockGraph),
}));

const mockCreateThreadId = vi.fn().mockReturnValue("test-thread-123");
const mockRegisterThread = vi.fn().mockResolvedValue(undefined);
const mockListThreads = vi.fn().mockResolvedValue([]);

vi.mock("../threads/manager.js", () => ({
  createThreadId: mockCreateThreadId,
  registerThread: mockRegisterThread,
  listThreads: mockListThreads,
}));

// Import app AFTER mocks are set up
// We need to import the express app — since index.ts starts the server, we need
// to restructure or import the app instance. We'll test by re-importing the module.
// For this test we use dynamic import after mocks.

describe("POST /invoke/stream", () => {
  let app: import("express").Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockGraph.stream.mockImplementation(() => mockStreamGenerator());
    mockGraph.getState.mockResolvedValue({
      values: {
        uiComponents: [],
        pendingApprovals: [],
        responseMetadata: {
          agentType: "chief_of_staff",
          agentDisplayName: "Chief of Staff",
        },
      },
    });
    mockCreateThreadId.mockReturnValue("test-thread-123");
    mockRegisterThread.mockResolvedValue(undefined);

    // Dynamically import the express app each time (module is cached, but mocks reset above)
    const mod = await import("../index.js");
    app = (mod as { app?: import("express").Express }).app!;
  });

  it("Test 1: POST /invoke/stream returns Content-Type text/event-stream", async () => {
    const response = await request(app)
      .post("/invoke/stream")
      .send({ message: "Hello", user_id: "user-1" })
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => callback(null, data));
      });

    expect(response.headers["content-type"]).toMatch(/text\/event-stream/);
  });

  it("Test 2: SSE stream emits at least one delta event with { type: 'delta', content: string }", async () => {
    const response = await request(app)
      .post("/invoke/stream")
      .send({ message: "Hello", user_id: "user-1" })
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => callback(null, data));
      });

    const body = response.body as string;
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    const events = lines.map((l) => JSON.parse(l.slice(6)));
    const deltaEvents = events.filter((e) => e.type === "delta");
    expect(deltaEvents.length).toBeGreaterThan(0);
    expect(typeof deltaEvents[0].content).toBe("string");
  });

  it("Test 3: SSE stream emits a done event as the final event with { type: 'done', thread_id: string }", async () => {
    const response = await request(app)
      .post("/invoke/stream")
      .send({ message: "Hello", user_id: "user-1" })
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => callback(null, data));
      });

    const body = response.body as string;
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    const events = lines.map((l) => JSON.parse(l.slice(6)));
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents.length).toBeGreaterThan(0);
    expect(typeof doneEvents[0].thread_id).toBe("string");
    // done event should be last
    expect(events[events.length - 1].type).toBe("done");
  });

  it("Test 4: POST /invoke/stream without message returns 400", async () => {
    const response = await request(app)
      .post("/invoke/stream")
      .send({ user_id: "user-1" });

    expect(response.status).toBe(400);
  });

  it("Test 5: POST /invoke/stream without user_id returns 400", async () => {
    const response = await request(app)
      .post("/invoke/stream")
      .send({ message: "Hello" });

    expect(response.status).toBe(400);
  });

  it("Test 6: HumanMessage echoes are filtered — only AIMessage content emitted as delta events", async () => {
    const { HumanMessage, AIMessage } =
      await import("@langchain/core/messages");

    // Mock stream that yields a HumanMessage echo followed by AIMessage
    async function* mixedStream() {
      yield [new HumanMessage("Echo me back"), { langgraph_node: "start" }];
      yield [new AIMessage("Real response"), { langgraph_node: "cosTools" }];
    }
    mockGraph.stream.mockImplementation(() => mixedStream());

    const response = await request(app)
      .post("/invoke/stream")
      .send({ message: "Echo me back", user_id: "user-1" })
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => callback(null, data));
      });

    const body = response.body as string;
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    const events = lines.map((l) => JSON.parse(l.slice(6)));
    const deltaEvents = events.filter((e) => e.type === "delta");
    // Should only have the AIMessage content, not the HumanMessage
    const contents = deltaEvents.map((e) => e.content);
    expect(contents).not.toContain("Echo me back");
    expect(contents.join("")).toContain("Real response");
  });
});
