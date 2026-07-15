import { NextRequest, NextResponse } from "next/server";
import { allUsersExist } from "@/lib/server/users";
import { formatSseMessage, subscribeUser } from "@/lib/server/sse";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  // Reject unknown users early so only valid user-scoped streams can stay open.
  const { userId } = await context.params;
  const userExists = await allUsersExist([userId]);

  if (!userExists) {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  // Open a long-lived stream and keep writing SSE frames until the client disconnects.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      // Centralize teardown so aborts, cancels, and double closes clean up safely.
      const closeStream = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        cleanup();

        try {
          controller.close();
        } catch {
          // Ignore double-close attempts during disconnect races.
        }
      };

      const sendMessage = (message: Parameters<typeof formatSseMessage>[0]) => {
        if (isClosed) {
          return;
        }

        controller.enqueue(encoder.encode(formatSseMessage(message)));
      };

      // Register this connection so other routes can push events to it later.
      const unsubscribe = subscribeUser(userId, sendMessage);
      const heartbeatInterval = setInterval(() => {
        sendMessage({ comment: "heartbeat" });
      }, 15_000);
      const abortHandler = () => {
        closeStream();
      };

      cleanup = () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        request.signal.removeEventListener("abort", abortHandler);
      };

      request.signal.addEventListener("abort", abortHandler);

      // Send one startup event so clients know the stream is alive immediately.
      sendMessage({
        event: "connected",
        data: {
          userId,
          connectedAt: new Date().toISOString(),
        },
      });

      if (request.signal.aborted) {
        closeStream();
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      // These headers tell browsers and proxies to keep the response open as an SSE stream.
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}