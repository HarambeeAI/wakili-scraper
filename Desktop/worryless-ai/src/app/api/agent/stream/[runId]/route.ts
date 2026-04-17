import { NextRequest } from "next/server";
import { registerListener } from "../../start/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: Record<string, unknown>) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));

        if (event === "complete" || event === "error") {
          controller.close();
        }
      }

      const unregister = registerListener(runId, send);

      _req.signal.addEventListener("abort", () => {
        unregister();
        try { controller.close(); } catch {}
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
