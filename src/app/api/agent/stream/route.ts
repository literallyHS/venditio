import { NextRequest } from "next/server";
import { getAgent } from "../../../../server/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const agent = getAgent();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const data = JSON.stringify(agent.getState());
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      const interval = setInterval(send, 1000);
      send();
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
