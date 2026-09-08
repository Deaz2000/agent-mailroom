import type { MailroomEvent } from "../types/mailroom";
import { LANE_CATALOG } from "../catalog/lanes";

const PULL_ADAPTER = "pull-consumer";

function laneStub(env: Env, lane: string): DurableObjectStub {
  const id = env.LANE_DO.idFromName(lane);
  return env.LANE_DO.get(id);
}

/** Primary queue consumer: claim delivery idempotently (v1: pull ledger only, no adapters). */
export async function handleEventsBatch(
  batch: MessageBatch<MailroomEvent>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const event = msg.body;
    try {
      if (!event?.id || !event?.data?.lane || !event?.data?.receiptId) {
        msg.retry();
        continue;
      }
      const stub = laneStub(env, event.data.lane);
      const claimRes = await stub.fetch("https://do/claim-delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id, adapter: PULL_ADAPTER }),
      });
      const claim = (await claimRes.json()) as { claimed: boolean };
      if (!claim.claimed) {
        msg.ack();
        continue;
      }
      await stub.fetch("https://do/mark-delivered", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id, adapter: PULL_ADAPTER }),
      });
      msg.ack();
    } catch (err) {
      console.error("events_consumer_error", {
        eventId: event?.id,
        error: err instanceof Error ? err.message : "unknown",
      });
      msg.retry();
    }
  }
}

/** DLQ consumer: archive failure durably then ack. */
export async function handleDlqBatch(
  batch: MessageBatch<MailroomEvent>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const event = msg.body;
    try {
      const lane = event?.data?.lane || LANE_CATALOG.frontDoor;
      const stub = laneStub(env, lane);
      await stub.fetch("https://do/archive-failure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: event?.id ?? "unknown",
          receiptId: event?.data?.receiptId ?? "unknown",
          adapter: PULL_ADAPTER,
          eventJson: JSON.stringify(event ?? {}),
          errorClass: "queue_exhausted",
          attempts: 5,
          lastError: "moved_to_dlq",
        }),
      });
      console.error("dlq_archived", {
        eventId: event?.id,
        receiptId: event?.data?.receiptId,
        lane,
      });
      msg.ack();
    } catch (err) {
      console.error("dlq_archive_failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      msg.retry();
    }
  }
}
