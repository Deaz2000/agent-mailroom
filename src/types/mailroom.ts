/** Shared mailroom types. Email content is always untrusted. */

export type OutboxStatus = "pending" | "sent" | "failed";
export type DeliveryStatus = "claimed" | "delivered" | "failed";

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

export interface ParsedEmail {
  envelopeFrom: string;
  envelopeTo: string;
  subject: string;
  textBody: string;
  textPreview: string;
  links: string[];
  attachments: AttachmentMeta[];
  authResults: string | null;
  headers: Record<string, string>;
}

export interface ReceiptRecord {
  id: string;
  lane: string;
  envelopeFrom: string;
  envelopeTo: string;
  subject: string;
  textBody: string;
  textPreview: string;
  linksJson: string;
  attachmentsJson: string;
  authResults: string | null;
  plusTag: string | null;
  receivedAt: string;
  expiresAt: string;
}

export interface MailroomEventData {
  schemaVersion: 1;
  receiptId: string;
  lane: string;
  envelopeFrom: string;
  envelopeTo: string;
  subject: string;
  receivedAt: string;
  bodyPreview: string;
  links: string[];
  attachments: AttachmentMeta[];
  receiptUrl: string;
}

export interface MailroomEvent {
  specversion: "1.0";
  id: string;
  type: "mailroom.receipt.created.v1";
  source: string;
  subject: string;
  time: string;
  datacontenttype: "application/json";
  data: MailroomEventData;
}

export interface StoreReceiptInput {
  receipt: ReceiptRecord;
  event: MailroomEvent;
}

export interface StoreReceiptResult {
  created: boolean;
  receiptId: string;
  eventId: string;
}
