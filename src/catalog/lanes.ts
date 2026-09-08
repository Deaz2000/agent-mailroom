export type LaneSlug = "frontdesk" | "test";

export interface LaneDefinition {
  slug: LaneSlug;
  label: string;
  purpose: string;
  enabled: boolean;
}

export interface LaneCatalog {
  schemaVersion: 1;
  frontDoor: LaneSlug;
  unknownRecipientPolicy: "reject";
  plusAddressing: "normalize-and-preserve-tag";
  domain: string;
  lanes: LaneDefinition[];
}

export const LANE_CATALOG: LaneCatalog = {
  schemaVersion: 1,
  frontDoor: "frontdesk",
  unknownRecipientPolicy: "reject",
  plusAddressing: "normalize-and-preserve-tag",
  domain: "mailroom.agentmailroom.net",
  lanes: [
    {
      slug: "frontdesk",
      label: "Front Desk",
      purpose: "Default intake",
      enabled: true,
    },
    {
      slug: "test",
      label: "Test",
      purpose: "End-to-end tests only",
      enabled: true,
    },
  ],
};

export interface ResolvedRecipient {
  lane: LaneSlug;
  localPart: string;
  plusTag: string | null;
  envelopeTo: string;
}

/** Normalize envelope recipient and map to a configured lane, or null if unknown. */
export function resolveRecipient(
  envelopeTo: string,
  catalog: LaneCatalog = LANE_CATALOG,
): ResolvedRecipient | null {
  const trimmed = envelopeTo.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain !== catalog.domain.toLowerCase()) return null;

  let base = local;
  let plusTag: string | null = null;
  const plus = local.indexOf("+");
  if (plus >= 0) {
    base = local.slice(0, plus);
    plusTag = local.slice(plus + 1) || null;
  }

  const lane = catalog.lanes.find((l) => l.enabled && l.slug === base);
  if (!lane) return null;

  return {
    lane: lane.slug,
    localPart: base,
    plusTag,
    envelopeTo: trimmed,
  };
}

export function listEnabledLanes(
  catalog: LaneCatalog = LANE_CATALOG,
): LaneDefinition[] {
  return catalog.lanes.filter((l) => l.enabled);
}
