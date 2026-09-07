# Migration

## Export

Page `GET /v1/lanes/{lane}/receipts` and write versioned JSONL. Also keep `mailroom-manifest.json` and `src/catalog/lanes.ts`.

## Replace an agent harness

v1 has no adapters. A later clerk must claim `(event_id, adapter)` before side effects and place email fields in an untrusted-data envelope. DNS, ingest, and receipts stay unchanged.

## Leave Cloudflare

1. Export JSONL receipts + manifest + failure records
2. Implement the same receive-only rules and event contract elsewhere
3. Dual-run staging
4. Switch only the mailroom subdomain MX
5. Verify, keep rollback window
6. Decommission requires separate approval

## Schema changes

Bump `mailroom.receipt.created.v1` / `schemaVersion` deliberately. Prefer additive fields.
