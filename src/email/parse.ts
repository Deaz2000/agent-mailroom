/** Parse inbound email from a single buffered raw ArrayBuffer. Never persist raw .eml. */
import type { AttachmentMeta, ParsedEmail } from "../types/mailroom";

const PREVIEW_CHARS = 500;
const MAX_LINKS = 50;
const LINK_RE = /https?:\/\/[^\s<>"'\)\]]+/gi;


function extractHeaders(rawText: string): Record<string, string> {
  const headerBlock = rawText.split(/\r?\n\r?\n/, 1)[0] ?? "";
  const out: Record<string, string> = {};
  let current: string | null = null;
  for (const line of headerBlock.split(/\r?\n/)) {
    if (/^\s/.test(line) && current) {
      out[current] = (out[current] + " " + line.trim()).trim();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx > 0) {
      current = line.slice(0, idx).toLowerCase();
      out[current] = line.slice(idx + 1).trim();
    }
  }
  return out;
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(text: string): string[] {
  const found = text.match(LINK_RE) ?? [];
  const unique: string[] = [];
  for (const link of found) {
    if (!unique.includes(link) && unique.length < MAX_LINKS) unique.push(link);
  }
  return unique;
}

function parseAttachmentMetas(rawText: string): AttachmentMeta[] {
  const metas: AttachmentMeta[] = [];
  const partRe = /Content-Disposition:\s*attachment[^\r\n]*filename\*?=(?:UTF-8'')?"?([^";\r\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = partRe.exec(rawText)) !== null) {
    const filename = m[1]!.replace(/"/g, "").trim();
    const sliceStart = Math.max(0, m.index - 400);
    const window = rawText.slice(sliceStart, m.index + 200);
    const ct = /Content-Type:\s*([^;\r\n]+)/i.exec(window)?.[1]?.trim() ?? "application/octet-stream";
    const sizeMatch = /size=(\d+)/i.exec(window);
    metas.push({
      filename,
      contentType: ct,
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
    });
  }
  return metas;
}

/** Buffer raw once at the call site; pass the buffer here. Do not re-read message.raw. */
export function parseRawEmail(
  raw: ArrayBuffer,
  envelopeFrom: string,
  envelopeTo: string,
): ParsedEmail {
  const rawText = new TextDecoder("utf-8").decode(raw);
  const headers = extractHeaders(rawText);
  const subject = headers["subject"] ?? "(no subject)";
  const authResults = headers["authentication-results"] ?? null;

  let textBody = "";
  const textPart = /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\s*$)/i.exec(rawText);
  if (textPart?.[1]) {
    const encoding = /Content-Transfer-Encoding:\s*(\S+)/i.exec(textPart[0] ?? "")?.[1]?.toLowerCase();
    textBody = encoding === "quoted-printable" ? decodeQuotedPrintable(textPart[1]) : textPart[1];
  } else {
    const bodyStart = rawText.search(/\r?\n\r?\n/);
    const body = bodyStart >= 0 ? rawText.slice(bodyStart).trim() : "";
    if (/<html/i.test(body)) textBody = stripHtml(body);
    else textBody = body.slice(0, 100_000);
  }

  textBody = textBody.replace(/\0/g, "").trim();
  const textPreview = textBody.slice(0, PREVIEW_CHARS);
  const links = extractLinks(textBody);
  const attachments = parseAttachmentMetas(rawText);

  return {
    envelopeFrom,
    envelopeTo,
    subject,
    textBody,
    textPreview,
    links,
    attachments,
    authResults,
    headers,
  };
}
