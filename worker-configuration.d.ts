/** Stub Env bindings. Regenerate with npm run cf-typegen after wrangler changes. */
interface Env {
  ENVIRONMENT: string;
  MAILROOM_DOMAIN: string;
  RECEIPT_RETENTION_DAYS: string;
  RECONCILE_INTERVAL_MS: string;
  MAX_MESSAGE_BYTES: string;
  RECEIPT_API_TOKEN: string;
  LANE_DO: DurableObjectNamespace;
  EVENTS_QUEUE: Queue;
}
