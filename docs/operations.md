# Operations

## Secrets

Copy `.dev.vars.example` to `.dev.vars` and set `RECEIPT_API_TOKEN`.
Never commit `.dev.vars`. Upload with `npx wrangler secret put RECEIPT_API_TOKEN`.

## Deploy (test)

```bash
npm install
npm run check
npm test
npx wrangler queues create agent-mailroom-events-test
npx wrangler queues create agent-mailroom-events-dlq-test
npm run deploy
```

## Email Routing

Zone: `agentmailroom.net`. Subdomain only: `mailroom.agentmailroom.net`.
Rules for `frontdesk@mailroom.agentmailroom.net` and `test@mailroom.agentmailroom.net` -> Worker `agent-mailroom-ingest-test`.
Keep catch-all disabled. Do not alter apex MX without review.

## Receipts API

All routes except `GET /health` require `Authorization: Bearer <RECEIPT_API_TOKEN>`.

- `GET /health`
- `GET /v1/lanes`
- `GET /v1/lanes/:lane/receipts?limit=` - `GET /v1/receipts/:id` 
- `GET /v1/events/:id/status`

## Reconciliation

DO alarm every 5 minutes plus cron `*/5 * * * *` over all enabled lanes.

## DLQ

`agent-mailroom-events-dlq-test` consumer archives to `failed_events` slot then acks.

## Disable intake

Pause Email Routing rules for mailroom addresses. Receipts remain until expiry.
