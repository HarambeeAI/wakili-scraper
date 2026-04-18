import { NextRequest } from "next/server";
import { registerCalendarListener } from "../../start/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(event: string, data: Record<string, unknown>) {
        if (closed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));

          if (event === "complete" || event === "error") {
            closed = true;
            controller.close();
          }
        } catch {
          closed = true;
        }
      }

      const unregister = registerCalendarListener(runId, send);

      _req.signal.addEventListener("abort", () => {
        unregister();
        closed = true;
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
