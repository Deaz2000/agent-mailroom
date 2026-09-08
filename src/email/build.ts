import type { MailroomEvent, ReceiptRecord } from "../types/mailroom";
import type { AttachmentMeta } from "../types/mailroom";
import { eventId, receiptId, addDaysIso } from "./ids";

const PREVIEW_EVENT_CHARS = 280;

export function buildReceiptAndEvent(opts: {
  lane: string;
  plusTag: string | null;
  parsed: {
    envelopeFrom: string;
    envelopeTo: string;
    subject: string;
    textBody: string;
    textPreview: string;
    links: string[];
    attachments: AttachmentMeta[];
    authResults: string | null;
  };
  retentionDays: number;
  publicBaseUrl: string;
}): { receipt: ReceiptRecord; event: MailroomEvent } {
  const now = new Date().toISOString();
  const rid = receiptId();
  const eid = eventId();
  const receipt: ReceiptRecord = {
    id: rid,
    lane: opts.lane,
    envelopeFrom: opts.parsed.envelopeFrom,
    envelopeTo: opts.parsed.envelopeTo,
    subject: opts.parsed.subject,
    textBody: opts.parsed.textBody,
    textPreview: opts.parsed.textPreview,
    linksJson: JSON.stringify(opts.parsed.links),
    attachmentsJson: JSON.stringify(opts.parsed.attachments),
    authResults: opts.parsed.authResults,
    plusTag: opts.plusTag,
    receivedAt: now,
    expiresAt: addDaysIso(now, opts.retentionDays),
  };
  const event: MailroomEvent = {
    specversion: "1.0",
    id: eid,
    type: "mailroom.receipt.created.v1",
    source: "urn:portable-mailroom:lane:" + opts.lane,
    subject: rid,
    time: now,
    datacontenttype: "application/json",
    data: {
      schemaVersion: 1,
      receiptId: rid,
      lane: opts.lane,
      envelopeFrom: opts.parsed.envelopeFrom,
      envelopeTo: opts.parsed.envelopeTo,
      subject: opts.parsed.subject,
      receivedAt: now,
      bodyPreview: opts.parsed.textPreview.slice(0, PREVIEW_EVENT_CHARS),
      links: opts.parsed.links,
      attachments: opts.parsed.attachments,
      receiptUrl: opts.publicBaseUrl.replace(/\/$/, "") + "/v1/receipts/" + rid,
    },
  };
  return { receipt, event };
}
