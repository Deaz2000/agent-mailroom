/** Constant-time string compare for bearer tokens. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const av = i < aBytes.length ? aBytes[i]! : 0;
    const bv = i < bBytes.length ? bBytes[i]! : 0;
    mismatch |= av ^ bv;
  }
  return mismatch === 0;
}

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function requireBearerAuth(
  request: Request,
  expectedToken: string,
): Response | null {
  if (!expectedToken) {
    return Response.json(
      { error: "server_misconfigured", message: "Receipt API token not configured" },
      { status: 503 },
    );
  }
  const provided = extractBearerToken(request.headers.get("Authorization"));
  if (!provided || !timingSafeEqual(provided, expectedToken)) {
    return Response.json(
      { error: "unauthorized", message: "Valid bearer token required" },
      { status: 401 },
    );
  }
  return null;
}
