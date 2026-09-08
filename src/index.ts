import { LaneMailbox } from "./do/LaneMailbox";
import { requireBearerAuth } from "./auth/bearer";
import { LANE_CATALOG, listEnabledLanes, resolveRecipient } from "./catalog/lanes";
import { buildReceiptAndEvent } from "./email/build";
import { parseRawEmail } from "./email/parse";
import { handleDlqBatch, handleEventsBatch } from "./consumers/queues";
import type { MailroomEvent } from "./types/mailroom";

export { LaneMailbox };

function laneStub(env: Env, lane: string): DurableObjectStub {
  return env.LANE_DO.get(env.LANE_DO.idFromName(lane));
}

async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const maxBytes = Number(env.MAX_MESSAGE_BYTES || "10485760");
  if (message.rawSize > maxBytes) {
    message.setReject("Message too large");
    return;
  }

  const resolved = resolveRecipient(message.to);
  if (!resolved) {
    message.setReject("Unknown recipient");
    return;
  }

  // Buffer raw exactly once; never persist raw .eml / R2.
  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = parseRawEmail(raw, message.from, resolved.envelopeTo);
  const publicBaseUrl = "https://" + env.MAILROOM_DOMAIN;
  const { receipt, event } = buildReceiptAndEvent({
    lane: resolved.lane,
    plusTag: resolved.plusTag,
    parsed,
    retentionDays: Number(env.RECEIPT_RETENTION_DAYS || "90"),
    publicBaseUrl,
  });

  const stub = laneStub(env, resolved.lane);
  const res = await stub.fetch("https://do/store", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ receipt, event }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("store_failed", { lane: resolved.lane, status: res.status, text });
    message.setReject("Temporary storage failure");
    return;
  }
}

async function handleHttp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({
      ok: true,
      service: "agent-mailroom",
      environment: env.ENVIRONMENT,
      receiveOnly: true,
    });
  }

  const authError = requireBearerAuth(request, env.RECEIPT_API_TOKEN);
  if (authError) return authError;

  if (request.method === "GET" && url.pathname === "/v1/lanes") {
    return Response.json({
      domain: LANE_CATALOG.domain,
      frontDoor: LANE_CATALOG.frontDoor,
      unknownRecipientPolicy: LANE_CATALOG.unknownRecipientPolicy,
      lanes: listEnabledLanes(),
    });
  }

  const laneReceipts = /^\/v1\/lanes\/([^/]+)\/receipts$/.exec(url.pathname);
  if (request.method === "GET" && laneReceipts) {
    const lane = decodeURIComponent(laneReceipts[1]!);
    if (!LANE_CATALOG.lanes.some((l) => l.slug === lane && l.enabled)) {
      return Response.json({ error: "unknown_lane" }, { status: 404 });
    }
    const limit = url.searchParams.get("limit") || "20";
    const stub = laneStub(env, lane);
    return stub.fetch("https://do/receipts?limit=" + encodeURIComponent(limit));
  }

  const receiptMatch = /^\/v1\/receipts\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && receiptMatch) {
    const id = decodeURIComponent(receiptMatch[1]!);
    for (const lane of listEnabledLanes()) {
      const stub = laneStub(env, lane.slug);
      const res = await stub.fetch("https://do/receipts/" + encodeURIComponent(id));
      if (res.status === 200) return res;
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const eventMatch = /^\/v1\/events\/([^/]+)\/status$/.exec(url.pathname);
  if (request.method === "GET" && eventMatch) {
    const id = decodeURIComponent(eventMatch[1]!);
    for (const lane of listEnabledLanes()) {
      const stub = laneStub(env, lane.slug);
      const res = await stub.fetch("https://do/events/" + encodeURIComponent(id) + "/status");
      if (res.status === 200) return res;
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

async function reconcileAllLanes(env: Env): Promise<void> {
  for (const lane of listEnabledLanes()) {
    const stub = laneStub(env, lane.slug);
    await stub.fetch("https://do/reconcile", { method: "POST" });
  }
}

const EVENTS_QUEUE_NAME = "agent-mailroom-events-test";
const DLQ_NAME = "agent-mailroom-events-dlq-test";

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return handleHttp(request, env);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await reconcileAllLanes(env);
  },

  async queue(batch: MessageBatch<MailroomEvent>, env: Env): Promise<void> {
    const name = batch.queue;
    if (name === DLQ_NAME) {
      await handleDlqBatch(batch, env);
      return;
    }
    if (name === EVENTS_QUEUE_NAME || name.endsWith("events-test")) {
      await handleEventsBatch(batch, env);
      return;
    }
    // Default: treat as events queue
    await handleEventsBatch(batch, env);
  },
} satisfies ExportedHandler<Env, MailroomEvent>;
