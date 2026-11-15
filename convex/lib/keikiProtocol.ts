/**
 * The wire protocol between Keiki and our POST /keiki/turn endpoint.
 *
 * Keiki runs the league agent on an external harness in push mode: for every
 * inbound text (and every notice we send ourselves) it POSTs a signed
 * "keiki.turn" to us, and we answer through the turn-scoped API at the
 * turn's `turnUrl`. Reference: https://onkeiki.com/docs/external-harness.md
 *
 * Everything here is pure and uses only Web Crypto, so the same code runs in
 * Convex's default runtime and in the unit tests.
 */

export type KeikiMessage = {
  /** What the contact typed. Keiki puts a "[Photo: …; attachment_id=…]" note here for a bare file. */
  text: string;
  /** True for a notice our own backend sent: the contact did not write it. */
  silent: boolean;
  attachments: { id: string; mimeType: string }[];
};

/**
 * The part of a turn we act on. It is what convex/keiki.ts hands to its
 * scheduled action, so it deliberately leaves out everything that is a
 * credential: the turn token and the signed attachment URLs.
 */
export type KeikiTurn = {
  turnId: string;
  agentId: string;
  /** The sender's phone in E.164 on a phone line; "api:<agent id>:<our user id>" on the API gateway. */
  conversationId: string;
  /** "imessage", "sms", "api", … */
  channel: string;
  /** Base of the turn's routes: {turnUrl}/messages, /attachments/{id}, /complete. */
  turnUrl: string;
  messages: KeikiMessage[];
  history: { role: "user" | "assistant"; content: string }[];
};

export type KeikiEvent =
  | { kind: "turn"; turn: KeikiTurn }
  /** Arrivals, cancellations, reactions and consent events: acknowledged, never acted on. */
  | { kind: "ignored"; type: string };

export type SignatureCheck = "ok" | "missing" | "malformed" | "stale" | "mismatch";

/** Keiki's own tolerance for clock drift and replay, in seconds. */
const SIGNATURE_TOLERANCE_SEC = 300;

/** History only feeds the "which photo did they mean" lookup, so each entry is kept short. */
const HISTORY_ENTRY_MAX_CHARS = 1000;

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Compares without an early exit, so timing does not leak how many characters matched. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * Checks `Keiki-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 * Call it on the raw request text, before JSON.parse: the HMAC covers the exact bytes.
 */
export async function verifyKeikiSignature(args: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  nowMs: number;
}): Promise<SignatureCheck> {
  if (!args.signatureHeader) return "missing";

  let timestamp: string | undefined;
  const candidates: string[] = [];
  for (const part of args.signatureHeader.split(",")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === "t") timestamp = value;
    if (name === "v1" && value) candidates.push(value.toLowerCase());
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || candidates.length === 0) return "malformed";

  const ageSec = Math.abs(Math.floor(args.nowMs / 1000) - Number(timestamp));
  if (ageSec > SIGNATURE_TOLERANCE_SEC) return "stale";

  const expected = await hmacSha256Hex(args.secret, `${timestamp}.${args.rawBody}`);
  return candidates.some((candidate) => sameHex(candidate, expected)) ? "ok" : "mismatch";
}

/**
 * The bearer for a turn's routes, signed with the agent's signing secret.
 *
 * Keiki also sends a ready-made token in the Keiki-Turn-Token header, but we
 * answer from a scheduled action after the HTTP request has returned, and a
 * token passed there would sit in Convex's scheduler arguments. Signing our
 * own keeps every credential out of stored state. Valid for five minutes.
 */
export async function signTurnCredential(args: {
  secret: string;
  agentId: string;
  turnId: string;
  nowMs: number;
}): Promise<string> {
  const payload = JSON.stringify({ a: args.agentId, t: args.turnId, ts: Math.floor(args.nowMs / 1000) });
  const payloadB64 = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signature = await hmacSha256Hex(args.secret, `keiki-turn-auth.v1.${payloadB64}`);
  return `kts1.${payloadB64}.${signature}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses a body whose signature has already been verified. Returns null for anything unusable. */
export function parseKeikiEvent(rawBody: string): KeikiEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isRecord(payload) || typeof payload.type !== "string") return null;
  if (payload.type !== "keiki.turn") return { kind: "ignored", type: payload.type };

  const links = payload.keiki;
  if (
    typeof payload.turnId !== "string" ||
    typeof payload.agentId !== "string" ||
    typeof payload.conversationId !== "string" ||
    !isRecord(links) ||
    typeof links.turnUrl !== "string" ||
    !Array.isArray(payload.messages)
  ) {
    return null;
  }

  const messages: KeikiMessage[] = [];
  for (const message of payload.messages) {
    if (!isRecord(message) || typeof message.text !== "string") return null;
    const attachments: KeikiMessage["attachments"] = [];
    for (const file of Array.isArray(message.attachments) ? message.attachments : []) {
      if (!isRecord(file) || typeof file.id !== "string") continue;
      attachments.push({ id: file.id, mimeType: typeof file.mimeType === "string" ? file.mimeType : "" });
    }
    messages.push({ text: message.text, silent: message.silent === true, attachments });
  }

  const history: KeikiTurn["history"] = [];
  for (const entry of Array.isArray(payload.history) ? payload.history : []) {
    if (!isRecord(entry) || typeof entry.content !== "string") continue;
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    history.push({ role: entry.role, content: entry.content.slice(0, HISTORY_ENTRY_MAX_CHARS) });
  }

  return {
    kind: "turn",
    turn: {
      turnId: payload.turnId,
      agentId: payload.agentId,
      conversationId: payload.conversationId,
      channel: isRecord(payload.channel) && typeof payload.channel.channel === "string" ? payload.channel.channel : "unknown",
      turnUrl: links.turnUrl.replace(/\/+$/, ""),
      messages,
      history,
    },
  };
}
