# Architecture

Portable Agent Mailroom for `mailroom.agentmailroom.net` (zone `agentmailroom.net`).

## Pipeline

```text
Cloudflare Email Routing (subdomain MX)
  -> Email Worker email() handler (agent-mailroom-ingest-test)
       1. reject oversized messages
       2. resolve envelope recipient against lane catalog (reject unknown)
       3. buffer message.raw exactly once (never persist raw .eml; no R2)
       4. parse bounded fields + full text body; attachment METADATA ONLY
       5. POST receipt+outbox to lane SQ.+^ Durable Object (atomic)
  -> LaneMailbox Durable Object (idFromName(lane))
       - receipts (90-day expiry)
       - transactional outbox
       - deliveries ledger
       - failed_events archive
       - alarm reconciler every 5 minutes
  -> immediate Queue publish + scheduled cron reconciler (*/5)
  -> Queue agent-mailroom-events-test (retries -> DLQ)
  -> DLQ agent-mailroom-events-dlq-test -> durable failure archive
  -> HTTP receipts API (bearer RECEIPT_API_TOKEN)
```

## Locked policy (v1)

- Receive-only; no Email Sending; no adapters
- Lanes: `frontdesk`, `test`
- Unknown recipients: reject
 - Public senders: allowed
- Retention: 90 days in SQ.+^ DO
- Full body stored in SQLite; attachments metadata only; no raw .eml; no R2

## Untrusted content

Every subject, body, link, header, filename, and attachment metadata field is hostile input. The receipts API labels responses with `untrusted: true`. Queue events carry bounded previews only.

## Event contract

CloudEvents-shaped JSON (`mailroom.receipt.created.v1`). Idempotency key = `event.id`.

## Components

| Piece | Role |
| | ----| --- |
| `src/index.ts` | email(), fetch(), scheduled(), queue() |
| `src/do/LaneMailbox.ts` | SQLite DO source of truth |
| `src/catalog/lanes.ts` | Declarative lane allowlist |
| `src/auth/bearer.ts` | Constant-time bearer check |
| `src/consumers/queues.ts` | Events + DLQ consumers |
| `mailroom-manifest.json` | Non-secret deploy metadata |
