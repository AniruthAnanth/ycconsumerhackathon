import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseKeikiEvent, signTurnCredential, verifyKeikiSignature } from "./keikiProtocol";

const secret = "whsec_test_secret";
const nowMs = 1_794_771_972_000;
const timestamp = String(nowMs / 1000);

function sign(rawBody: string, at = timestamp): string {
  const mac = createHmac("sha256", secret).update(`${at}.${rawBody}`).digest("hex");
  return `t=${at},v1=${mac}`;
}

describe("verifyKeikiSignature", () => {
  const rawBody = JSON.stringify({ type: "keiki.turn", turnId: "t1" });

  it("accepts a body signed with the agent's secret", async () => {
    expect(await verifyKeikiSignature({ rawBody, signatureHeader: sign(rawBody), secret, nowMs })).toBe("ok");
  });

  it("rejects a body changed after signing", async () => {
    expect(await verifyKeikiSignature({ rawBody: rawBody + " ", signatureHeader: sign(rawBody), secret, nowMs })).toBe("mismatch");
  });

  it("rejects a signature made with another secret", async () => {
    const forged = `t=${timestamp},v1=${createHmac("sha256", "other").update(`${timestamp}.${rawBody}`).digest("hex")}`;
    expect(await verifyKeikiSignature({ rawBody, signatureHeader: forged, secret, nowMs })).toBe("mismatch");
  });

  it("rejects a replay older than five minutes", async () => {
    const old = String(nowMs / 1000 - 301);
    expect(await verifyKeikiSignature({ rawBody, signatureHeader: sign(rawBody, old), secret, nowMs })).toBe("stale");
  });

  it("rejects a missing or malformed header", async () => {
    expect(await verifyKeikiSignature({ rawBody, signatureHeader: null, secret, nowMs })).toBe("missing");
    expect(await verifyKeikiSignature({ rawBody, signatureHeader: "v1=abc", secret, nowMs })).toBe("malformed");
  });
});

describe("signTurnCredential", () => {
  it("matches Keiki's kts1 format", async () => {
    const credential = await signTurnCredential({ secret, agentId: "agent-1", turnId: "turn-1", nowMs });
    const [version, payloadB64, signature] = credential.split(".");
    expect(version).toBe("kts1");
    expect(JSON.parse(Buffer.from(payloadB64, "base64url").toString())).toEqual({ a: "agent-1", t: "turn-1", ts: nowMs / 1000 });
    expect(signature).toBe(createHmac("sha256", secret).update(`keiki-turn-auth.v1.${payloadB64}`).digest("hex"));
  });
});

describe("parseKeikiEvent", () => {
  // The shape of a real turn captured from Keiki on 2026-11-15, trimmed.
  const turn = {
    type: "keiki.turn",
    version: 1,
    turnId: "406a5653ccf9e0923c224ed7f9ebf7f2",
    agentId: "af0a03a5",
    conversationId: "+14155550123",
    heldBack: false,
    silent: false,
    channel: { channel: "imessage" },
    messages: [
      {
        text: "",
        messageId: "m1",
        attachments: [{ id: "att_1", filename: "IMG_1.heic", mimeType: "image/heic", size: 4830, url: "https://onkeiki.com/a/att_1" }],
      },
    ],
    history: [{ role: "assistant", content: "Quick-time: 20 push-ups." }],
    keiki: { apiBase: "https://onkeiki.com/api/v1", turnUrl: "https://onkeiki.com/api/v1/turns/406a/", mcpUrl: "https://onkeiki.com/api/v1/harness/mcp" },
  };

  it("reads a turn with a photo", () => {
    const event = parseKeikiEvent(JSON.stringify(turn));
    expect(event?.kind).toBe("turn");
    if (event?.kind !== "turn") return;
    expect(event.turn.conversationId).toBe("+14155550123");
    expect(event.turn.channel).toBe("imessage");
    expect(event.turn.messages).toEqual([{ text: "", silent: false, attachments: [{ id: "att_1", mimeType: "image/heic" }] }]);
    expect(event.turn.turnUrl).toBe("https://onkeiki.com/api/v1/turns/406a");
  });

  it("keeps no credential: the signed attachment URL is dropped", () => {
    expect(JSON.stringify(parseKeikiEvent(JSON.stringify(turn)))).not.toContain("https://onkeiki.com/a/att_1");
  });

  it("acknowledges events that are not turns without acting on them", () => {
    expect(parseKeikiEvent(JSON.stringify({ type: "keiki.reaction", eventId: "e1" }))).toEqual({ kind: "ignored", type: "keiki.reaction" });
  });

  it("returns null for a body it cannot use", () => {
    expect(parseKeikiEvent("not json")).toBeNull();
    expect(parseKeikiEvent(JSON.stringify({ type: "keiki.turn", turnId: "t1" }))).toBeNull();
  });
});
