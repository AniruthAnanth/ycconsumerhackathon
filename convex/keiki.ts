/**
 * Keiki: the league agent players text.
 *
 * Keiki owns the phone line (a shared iMessage number) and the conversation. This module is
 * the agent's brain: Keiki runs it as an "external harness", which means every message is
 * pushed to POST /keiki/turn and the reply is whatever we post back to that turn.
 *
 *   a player texts ──▶ Keiki ──POST /keiki/turn──▶ keikiTurn ──schedules──▶ answerTurn ──▶ {turnUrl}/messages
 *   send (drops, …) ──notice──▶ Keiki ──POST /keiki/turn──▶ answerTurn delivers the text as written
 *   chat (the app)  ──gateway─▶ Keiki ──POST /keiki/turn──▶ answerTurn ──▶ the reply returns to the app
 *
 * So all three paths meet in answerTurn, and a command means the same thing in a text and in
 * the in-app chat. The wire format is in lib/keikiProtocol.ts; what the agent understands and
 * every sentence it says are in lib/keikiText.ts.
 *
 * Two limits of the shared number shape this file: it has no group chats, so a league text is
 * sent to each member one-to-one, and the agent may only text someone who has texted it first
 * (the join code, see `line`).
 *
 * Playing by text is opt-in (users.keikiOptIn). Texting the number opts a phone in, the app's
 * "Play by text" switch turns it on or off, and send never texts an account that hasn't.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  env,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { askJson } from "./ai";
import { currentWeek } from "./leagues";
import { requireUser } from "./lib/auth";
import {
  parseKeikiEvent,
  signLinkCode,
  signTurnCredential,
  verifyKeikiSignature,
  type KeikiTurn,
} from "./lib/keikiProtocol";
import {
  captionOf,
  chooseProofTarget,
  joinLink,
  lastAttachmentId,
  leagueTime,
  linkCodeIn,
  parseCommand,
  rankLine,
  reply,
  SCORING_RULES,
  splitLeagueTag,
  unwrapOutbound,
  weekFacts,
  withLeagueTag,
  wrapOutbound,
  type ProofTargets,
  type StandingRow,
} from "./lib/keikiText";

const KEIKI_API = "https://onkeiki.com/api/v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** A player's week and a league's roster are far smaller; this only bounds the reads. */
const MAX_ROWS = 200;

/** The API gateway names a conversation "api:<agent id>:<x-conversation-id>"; a phone line uses the number. */
const GATEWAY_PREFIX = "api:";

type League = { leagueId: Id<"leagues">; name: string };
type Arrival = { lat: number; lng: number };

/** Who a conversation is with. */
type Player = {
  /** The account that owns the phone. */
  accountId: Id<"users">;
  /** That account's users.keikiOptIn, null while they were never asked. */
  optIn: boolean | null;
  /** The player the account plays as: itself, or a seeded player under Switch Player. */
  userId: Id<"users">;
  league: League | null;
};

/** What proofTargets reads; answerPhoto adds whether the player has arrived at each place. */
type OpenTasks = Pick<ProofTargets<Id<"tasks">>, "quickTime" | "photoTasks"> & {
  locationTasks: { taskId: Id<"tasks">; title: string; placeName?: string }[];
  /** Open tasks no photo can prove. They are only ever listed, when a player asks what is left. */
  canvasTasks: { title: string }[];
};

// ─── Inbound: POST /keiki/turn ───────────────────────────────────────────────────────────────

const turnArgs = v.object({
  turnId: v.string(),
  agentId: v.string(),
  conversationId: v.string(),
  channel: v.string(),
  turnUrl: v.string(),
  messages: v.array(
    v.object({
      text: v.string(),
      silent: v.boolean(),
      attachments: v.array(v.object({ id: v.string(), mimeType: v.string() })),
    }),
  ),
  history: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() })),
});

/**
 * Accepts a turn from Keiki. The signature is checked on the raw body before anything is
 * parsed, and the work is handed to a scheduled action so Keiki gets its 202 at once: judging
 * a photo takes longer than a webhook should stay open.
 */
export const keikiTurn = httpAction(async (ctx, request) => {
  const secret = env.KEIKI_SIGNING_SECRET;
  if (!secret) return new Response("KEIKI_SIGNING_SECRET is not set", { status: 503 });

  const rawBody = await request.text();
  const signature = await verifyKeikiSignature({
    rawBody,
    signatureHeader: request.headers.get("Keiki-Signature"),
    secret,
    nowMs: Date.now(),
  });
  if (signature !== "ok") return new Response(`Keiki signature rejected: ${signature}`, { status: 401 });

  const event = parseKeikiEvent(rawBody);
  if (event === null) return new Response("Not a Keiki event", { status: 400 });
  if (event.kind === "turn") await ctx.scheduler.runAfter(0, internal.keiki.answerTurn, { turn: event.turn });
  return new Response(null, { status: 202 });
});

/** Works out the replies to one turn, posts them to the turn and settles it. */
export const answerTurn = internalAction({
  args: { turn: turnArgs },
  returns: v.null(),
  handler: async (ctx, { turn }) => {
    const secret = env.KEIKI_SIGNING_SECRET;
    if (!secret) return null;
    const bearer = await signTurnCredential({ secret, agentId: turn.agentId, turnId: turn.turnId, nowMs: Date.now() });

    let texts: string[];
    let failure: string | null = null;
    try {
      texts = await repliesTo(ctx, turn, bearer);
    } catch (error) {
      failure = String(error);
      console.error(`Keiki turn ${turn.turnId} failed: ${failure}`);
      // A player who wrote to us hears that it failed; a failed outbound text stays silent.
      texts = turn.messages.some((message) => !message.silent) ? [reply.trouble] : [];
    }

    for (const [index, text] of texts.entries()) {
      // The key makes a retried turn harmless: Keiki never sends twice under one key.
      await postToTurn(turn, bearer, "/messages", { text, idempotencyKey: `${turn.turnId}:${index}` });
    }
    await postToTurn(turn, bearer, "/complete", failure === null ? { status: "completed" } : { status: "failed", error: failure });
    return null;
  },
});

async function postToTurn(
  turn: KeikiTurn,
  bearer: string,
  path: "/messages" | "/complete",
  body: Record<string, string>,
): Promise<void> {
  const response = await fetch(`${turn.turnUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) console.warn(`Keiki ${path} on turn ${turn.turnId} answered ${response.status}`);
}

async function repliesTo(ctx: ActionCtx, turn: KeikiTurn, bearer: string): Promise<string[]> {
  // Our own outbound texts come back to us as silent notices. Deliver each exactly as written.
  const outbound = turn.messages
    .filter((message) => message.silent)
    .map((message) => unwrapOutbound(message.text))
    .filter((text): text is string => text !== null);
  const written = turn.messages.filter((message) => !message.silent);
  if (written.length === 0) return outbound;

  const said = splitLeagueTag(written.map((message) => captionOf(message.text)).join(" "));
  const onPhone = !turn.conversationId.startsWith(GATEWAY_PREFIX);

  // The app's "Play by text" link writes a code for the account it was opened on. Sending it
  // ties this number to that account, which is how an account that signed up without this
  // number (or a reinstall, which is a new account) gets its texts.
  const linkCode = onPhone ? linkCodeIn(said.text) : null;
  const linked: boolean =
    linkCode !== null && (await ctx.runMutation(internal.keiki.linkPhone, { phone: turn.conversationId, ...linkCode }));

  const player: Player | null = await ctx.runQuery(internal.keiki.playerFor, {
    conversationId: turn.conversationId,
    leagueTag: said.leagueId,
  });
  if (player === null) return [...outbound, reply.unknownNumber];

  // Texting the number is the opt-in. The first text from a phone turns it on; after the
  // player has switched it off in the app, only sending the join code again turns it back on.
  const sentJoinCode = saysJoinCode(said.text);
  if (onPhone && (player.optIn === null || (sentJoinCode && !player.optIn))) {
    await ctx.runMutation(internal.keiki.recordOptIn, { accountId: player.accountId });
  }

  const file = written.flatMap((message) => message.attachments)[0];
  if (file) return [...outbound, await answerPhoto(ctx, turn, bearer, player, file.id, said.text)];
  if (sentJoinCode || linked) return [...outbound, reply.welcome];
  return [...outbound, await answerText(ctx, turn, bearer, player, said.text)];
}

function saysJoinCode(text: string): boolean {
  const joinCode = env.KEIKI_JOIN_CODE;
  return joinCode !== undefined && joinCode !== "" && text.toUpperCase().includes(joinCode.toUpperCase());
}

// ─── A texted proof ──────────────────────────────────────────────────────────────────────────

async function answerPhoto(
  ctx: ActionCtx,
  turn: KeikiTurn,
  bearer: string,
  player: Player,
  attachmentId: string,
  caption: string,
): Promise<string> {
  const open: OpenTasks = await ctx.runQuery(internal.keiki.proofTargets, { userId: player.userId, now: Date.now() });

  // A text carries no GPS. A task tied to a place can still be proved by text when the app has
  // just seen this phone arrive there: the arrival supplies the coordinates the referee needs.
  const arrivals = new Map<Id<"tasks">, Arrival>();
  for (const task of open.locationTasks) {
    const arrival = await ctx.runQuery(internal.checkins.recentArrival, { userId: player.userId, taskId: task.taskId });
    if (arrival !== null) arrivals.set(task.taskId, { lat: arrival.lat, lng: arrival.lng });
  }
  const targets: ProofTargets<Id<"tasks">> = {
    ...open,
    locationTasks: open.locationTasks.map((task) => ({ ...task, arrived: arrivals.has(task.taskId) })),
  };

  const choice = chooseProofTarget(targets, caption);
  if (choice.kind === "ask") return reply.whichTask(choice.titles);
  if (choice.kind === "checkIn") return reply.needsCheckIn(choice.title, choice.placeName);
  if (choice.kind === "none") return reply.nothingToProve;
  return await judge(ctx, turn, bearer, player, choice.taskId, attachmentId, arrivals.get(choice.taskId));
}

/** Stores the photo, runs the same referee the app uses, and words the verdict. */
async function judge(
  ctx: ActionCtx,
  turn: KeikiTurn,
  bearer: string,
  player: Player,
  taskId: Id<"tasks">,
  attachmentId: string,
  arrival?: Arrival,
): Promise<string> {
  // Fetched through the turn's own route rather than the signed URL in the payload: it needs
  // no stored credential and still works for a photo sent a few texts ago.
  const media = await ctx.runAction(internal.keikiMedia.ingest, {
    url: `${turn.turnUrl}/attachments/${attachmentId}`,
    mimeType: "",
    bearer,
  });
  if (!media.ok) return media.reason === "unsupported" ? reply.notMedia : reply.mediaFailed;

  const verdict = await ctx.runAction(internal.proofs.verifyForUser, {
    userId: player.userId,
    taskId,
    storageId: media.storageId,
    mediaType: media.mediaType,
    via: "keiki",
    ...arrival,
  });
  if (!verdict.pass) return reply.verdict(verdict, "");

  // A drop's task scores only in that drop's league, so that is the table to quote.
  const dropLeague: Id<"leagues"> | null = await ctx.runQuery(internal.keiki.dropLeagueOf, { taskId });
  const leagueId = dropLeague ?? player.league?.leagueId;
  if (leagueId === undefined) return reply.verdict(verdict, "");
  try {
    const rows: StandingRow[] = await ctx.runQuery(internal.standings.tableForLeague, { leagueId });
    return reply.verdict(verdict, rankLine(rows, player.userId));
  } catch (error) {
    // The proof is already recorded; a missing rank must not turn a pass into an error text.
    console.warn(`Standings unavailable after a texted proof: ${String(error)}`);
    return reply.verdict(verdict, "");
  }
}

// ─── Text commands ───────────────────────────────────────────────────────────────────────────

async function answerText(
  ctx: ActionCtx,
  turn: KeikiTurn,
  bearer: string,
  player: Player,
  text: string,
): Promise<string> {
  const command = parseCommand(text);
  const now = Date.now();

  if (command.kind === "standings") {
    if (player.league === null) return reply.noLeague;
    const rows: StandingRow[] = await ctx.runQuery(internal.standings.tableForLeague, { leagueId: player.league.leagueId });
    return reply.standings(player.league.name, rows, player.userId);
  }

  if (command.kind === "open" || command.kind === "pass") {
    const { mystery } = await ctx.runQuery(internal.keiki.dropsFor, { userId: player.userId, now });
    if (mystery === null) return reply.noMystery;
    if (command.kind === "pass") {
      await ctx.runMutation(internal.drops.passMysteryFor, { userId: player.userId, dropId: mystery.dropId });
      return reply.mysteryPassed;
    }
    await ctx.runMutation(internal.drops.acceptMysteryFor, {
      userId: player.userId,
      dropId: mystery.dropId,
      ...(command.wager > 0 ? { wager: command.wager } : {}),
    });
    // Read back rather than echoed: drops clamps a wager to 50 and to the player's own points.
    const wager: number = await ctx.runQuery(internal.keiki.wagerOn, { dropId: mystery.dropId });
    return reply.mysteryOpened({ title: mystery.title, points: mystery.points, wager });
  }

  if (command.kind === "in") {
    const { session } = await ctx.runQuery(internal.keiki.dropsFor, { userId: player.userId, now });
    if (session === null) return reply.noSession;
    await ctx.runMutation(internal.drops.rsvpFor, { userId: player.userId, dropId: session.dropId });
    return reply.joinedSession({ title: session.title, placeName: session.placeName, when: leagueTime(session.startsAt) });
  }

  if (command.kind === "pick") {
    // The answer to "Which task is this for?": the photo is the last one in the conversation.
    const attachmentId = lastAttachmentId(turn.history);
    if (attachmentId === null) return reply.noPendingPhoto;
    const open: OpenTasks = await ctx.runQuery(internal.keiki.proofTargets, { userId: player.userId, now });
    const task = open.photoTasks[command.choice - 1];
    if (task === undefined) return reply.nothingToProve;
    return await judge(ctx, turn, bearer, player, task.taskId, attachmentId);
  }

  return await answerFreeText(ctx, turn, player, command.text);
}

// ─── Free text ───────────────────────────────────────────────────────────────────────────────

type Understood = {
  isSessionProposal: boolean;
  title: string | null;
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  /** ISO 8601 with an offset. */
  startsAt: string | null;
  reply: string;
};

const UNDERSTAND_INSTRUCTIONS = [
  "You are the Lineup league agent: the referee and scorekeeper of a fantasy league for people's own lives.",
  "A player sent you the message at the end. Do exactly one of two things.",
  "1. If it proposes a group session for the league (an activity with a place and a time, like 'run tomorrow 7am at",
  "Dolores Park'), set isSessionProposal to true and fill title (two to five words, like 'Morning run'), placeName, lat",
  "and lng (your best estimate of that place's coordinates; the league is in San Francisco unless the message says",
  "otherwise) and startsAt (ISO 8601 with the America/Los_Angeles offset, resolving 'tomorrow' and weekday names from",
  "the current time given). Leave reply empty. If the place or the time is missing, it is not a proposal yet.",
  "2. Otherwise set isSessionProposal to false, set the session fields to null, and write reply: one or two short",
  "lines (up to six when the player asks you to explain something, with an example from their own numbers if they",
  "ask for one), sports-desk tone, no emojis, answered only from the league facts given. Answer with the names and numbers",
  "the question is about: the opponent and both totals for 'who am I playing', the gap for 'how far behind am I',",
  "the task titles for 'what's left'. Speak to the player as 'you'. If the facts don't answer it, say",
  "what you can do: judge a photo proof, STANDINGS, OPEN or PASS the mystery task, IN to join a group session.",
].join(" ");

const UNDERSTAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isSessionProposal", "title", "placeName", "lat", "lng", "startsAt", "reply"],
  properties: {
    isSessionProposal: { type: "boolean" },
    title: { type: ["string", "null"] },
    placeName: { type: ["string", "null"] },
    lat: { type: ["number", "null"] },
    lng: { type: ["number", "null"] },
    startsAt: { type: ["string", "null"] },
    reply: { type: "string" },
  },
};

/** A session can be proposed up to two weeks out; anything further is a misread date. */
const SESSION_HORIZON_MS = 2 * WEEK_MS;

/**
 * Anything that is not a command. One model call decides whether the player proposed a group
 * session ("run tomorrow 7am at Dolores Park") or asked something, and answers the latter from
 * the league's own numbers. If the model can't be reached, the player gets the command menu.
 */
async function answerFreeText(ctx: ActionCtx, turn: KeikiTurn, player: Player, text: string): Promise<string> {
  if (text === "") return reply.help;
  const now = Date.now();

  let understood: Understood;
  try {
    understood = await askJson<Understood>({
      name: "league_agent_message",
      instructions: UNDERSTAND_INSTRUCTIONS,
      text: await leagueFacts(ctx, turn, player, text, now),
      schema: UNDERSTAND_SCHEMA,
    });
  } catch (error) {
    console.warn(`The league agent could not reach the model: ${String(error)}`);
    return reply.help;
  }
  if (!understood.isSessionProposal) return understood.reply.trim() || reply.help;

  const { title, placeName, lat, lng } = understood;
  const startsAt = Date.parse(understood.startsAt ?? "");
  const usable = title && placeName && lat !== null && lng !== null && startsAt > now && startsAt < now + SESSION_HORIZON_MS;
  if (!usable) return reply.sessionNeedsDetail;
  if (player.league === null) return reply.noLeague;

  // drops announces the session to the league itself, so this is the only text we send.
  await ctx.runMutation(internal.drops.createGroupSessionFor, {
    userId: player.userId,
    leagueId: player.league.leagueId,
    title,
    place: { name: placeName, lat, lng },
    startsAt,
  });
  return reply.sessionPosted({ title, placeName, when: leagueTime(startsAt) });
}

/** What the model is told about the league: enough to answer "how am I doing", nothing private. */
async function leagueFacts(ctx: ActionCtx, turn: KeikiTurn, player: Player, text: string, now: number): Promise<string> {
  const open: OpenTasks = await ctx.runQuery(internal.keiki.proofTargets, { userId: player.userId, now });
  const openTasks = [
    ...(open.quickTime ? [`${open.quickTime.title} (the live quick-time drop; reply with a photo)`] : []),
    ...open.photoTasks.map((task) => `${task.title} (photo)`),
    ...open.locationTasks.map((task) => `${task.title} (photo${task.placeName ? ` at ${task.placeName}` : ""})`),
    ...open.canvasTasks.map((task) => `${task.title} (submitted on Canvas)`),
  ];
  let week = "The player is not in a league yet.";
  if (player.league !== null) {
    const { leagueId, name } = player.league;
    try {
      const rows = await ctx.runQuery(internal.standings.tableForLeague, { leagueId });
      const opponentId: Id<"users"> | null = await ctx.runQuery(internal.keiki.opponentOf, { leagueId, userId: player.userId });
      week = weekFacts(name, rows, player.userId, opponentId);
    } catch {
      // A league that has not started its first week has no table yet.
      week = `League: ${name}. Its standings are unavailable right now.`;
    }
  }
  const earlier = turn.history
    .slice(-6)
    .map((entry) => `${entry.role === "user" ? "Player" : "You"}: ${splitLeagueTag(captionOf(entry.content)).text}`);

  return [
    `Current time: ${new Date(now).toISOString()}, which is ${leagueTime(now)} in America/Los_Angeles.`,
    week,
    `This player's open tasks this week and how each is proved: ${openTasks.join("; ") || "none"}.`,
    `How scoring works: ${SCORING_RULES}`,
    earlier.length > 0 ? `Earlier in this conversation:\n${earlier.join("\n")}` : "",
    `Message: ${text}`,
  ]
    .filter((part) => part !== "")
    .join("\n\n");
}

// ─── Outbound: texts from the rest of the backend ────────────────────────────────────────────

/**
 * Texts one player or every member of a league. Other modules schedule this
 * (`ctx.scheduler.runAfter(0, internal.keiki.send, { leagueId, text })`) and never await it.
 *
 * Keiki has no "send a text" call for an agent like ours: we raise a notice on the player's
 * conversation, Keiki turns it into a turn, and answerTurn posts the text. Only players who
 * opted in to playing by text are sent anything (see phonesOf), and one who has never texted
 * the number has no conversation and is skipped.
 */
export const send = internalAction({
  args: {
    userId: v.optional(v.id("users")),
    leagueId: v.optional(v.id("leagues")),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = env.KEIKI_API_KEY;
    const agentId = env.KEIKI_AGENT_ID;
    if (!apiKey || !agentId) {
      // The text is in the warning so a backend without Keiki (tests, a fresh deployment)
      // still shows what would have been sent.
      console.warn(`Keiki text not sent, KEIKI_API_KEY or KEIKI_AGENT_ID is not set: ${args.text}`);
      return null;
    }
    const phones: string[] = await ctx.runQuery(internal.keiki.phonesOf, { userId: args.userId, leagueId: args.leagueId });
    const statuses = await Promise.all(
      phones.map(async (phone) => {
        const response = await fetch(`${KEIKI_API}/developer/agents/${agentId}/notice`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ phone, text: wrapOutbound(args.text) }),
        });
        return response.status;
      }),
    );
    // 404 is a player who has not texted the number yet. Counts only: no phone numbers in logs.
    const reached = statuses.filter((status) => status === 200).length;
    const notConnected = statuses.filter((status) => status === 404).length;
    console.log(`Keiki text: ${reached} sent, ${notConnected} not connected, ${statuses.length - reached - notConnected} failed`);
    return null;
  },
});

// ─── The in-app chat ─────────────────────────────────────────────────────────────────────────

/**
 * One message to the league agent from the app's chat screen. It goes through Keiki's
 * OpenAI-compatible gateway, with the agent as the model, so the conversation is stored and
 * traced by Keiki like a texted one, and comes back to answerTurn like any other turn.
 */
export const chat = action({
  args: { leagueId: v.id("leagues"), text: v.string() },
  returns: v.object({ reply: v.string() }),
  handler: async (ctx, { leagueId, text }) => {
    const userId: Id<"users"> = await ctx.runQuery(internal.keiki.chatCaller, { leagueId });
    const apiKey = env.KEIKI_API_KEY;
    const agentId = env.KEIKI_AGENT_ID;
    if (!apiKey || !agentId) throw new ConvexError("The league agent is not set up yet");

    const response = await fetch(`${KEIKI_API}/openai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // One Keiki conversation per player. Keiki allows 64 characters here, too few for a
        // league id as well, so the league rides on the message (see withLeagueTag).
        "x-conversation-id": userId,
      },
      body: JSON.stringify({
        model: agentId,
        messages: [{ role: "user", content: withLeagueTag(text.slice(0, 1000), leagueId) }],
      }),
    });
    // Keiki runs one turn per conversation at a time and refuses a second instead of queueing it.
    if (response.status === 409) return { reply: "Still on your last message. Give me a second." };
    if (!response.ok) throw new ConvexError("The league agent is not answering right now");

    const completion: unknown = await response.json();
    return { reply: completionText(completion) ?? reply.trouble };
  },
});

function completionText(completion: unknown): string | null {
  if (typeof completion !== "object" || completion === null || !("choices" in completion)) return null;
  const choices = completion.choices;
  if (!Array.isArray(choices)) return null;
  const content: unknown = choices[0]?.message?.content;
  return typeof content === "string" && content.length > 0 ? content : null;
}

/** Resolves the chat's caller and checks they are in the league they are asking about. */
export const chatCaller = internalQuery({
  args: { leagueId: v.id("leagues") },
  returns: v.id("users"),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", me._id))
      .first();
    if (membership === null) throw new ConvexError("You are not in this league");
    return me._id;
  },
});

// ─── Play by text: the opt-in ────────────────────────────────────────────────────────────────

/**
 * What the app's "Play by text" row shows: the number, the link that opens Messages with the
 * join code typed, and whether this device has opted in. On the shared number, sending that
 * first text is what allows the agent to text the player back, so the row's switch opens it.
 * The text also carries this account's link code, so the number it is sent from becomes the
 * account's number whatever was typed at sign-up (see linkPhone).
 */
export const line = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ number: v.string(), joinCode: v.string(), smsUrl: v.string(), optedIn: v.boolean() }),
  ),
  handler: async (ctx) => {
    const account = await deviceAccount(ctx);
    const number = env.KEIKI_LINE_NUMBER;
    const joinCode = env.KEIKI_JOIN_CODE;
    if (!number || !joinCode) return null;
    const secret = env.KEIKI_SIGNING_SECRET;
    const linkCode = secret ? await linkCodeOf(secret, account) : undefined;
    return { number, joinCode, smsUrl: joinLink(number, joinCode, linkCode), optedIn: account.keikiOptIn === true };
  },
});

/** The "Play by text" switch. */
export const setOptIn = mutation({
  args: { optIn: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { optIn }) => {
    const account = await deviceAccount(ctx);
    await ctx.db.patch("users", account._id, { keikiOptIn: optIn });
    return null;
  },
});

/** A text arrived from this account's phone, which is the other way to opt in. */
export const recordOptIn = internalMutation({
  args: { accountId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { accountId }) => {
    await ctx.db.patch("users", accountId, { keikiOptIn: true });
    return null;
  },
});

/**
 * A text carrying a link code arrived from this number. As in onboarding (users.createUser),
 * the number moves to the code's account and any other account gives it up, so by_phone keeps
 * naming one device. Sending the text is also the opt-in. False when the code is not ours.
 */
export const linkPhone = internalMutation({
  args: { phone: v.string(), code: v.string(), createdMs: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { phone, code, createdMs }) => {
    const secret = env.KEIKI_SIGNING_SECRET;
    if (!secret) return false;
    // The code names a millisecond; its proof picks the account among any created in it.
    const createdThen = await ctx.db
      .query("users")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", createdMs).lt("_creationTime", createdMs + 1))
      .take(10);
    let account: Doc<"users"> | null = null;
    for (const candidate of createdThen) {
      if ((await linkCodeOf(secret, candidate)) === code) account = candidate;
    }
    if (account === null) return false;

    const owners = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .take(10);
    for (const owner of owners) {
      // A seeded demo player keeps its number: Reset Seed finds it by that.
      if (owner._id !== account._id && !owner.isSeed) await ctx.db.patch("users", owner._id, { phone: undefined });
    }
    await ctx.db.patch("users", account._id, { phone, keikiOptIn: true });
    return true;
  },
});

function linkCodeOf(secret: string, account: Doc<"users">): Promise<string> {
  return signLinkCode({ secret, accountId: account._id, createdMs: account._creationTime });
}

/**
 * The account signed in on this device. Under Switch Player this is deliberately not
 * requireUser's answer: texting belongs to the phone in the player's hand and its number, not
 * to the seeded player the device is acting as.
 */
async function deviceAccount(ctx: QueryCtx): Promise<Doc<"users">> {
  await requireUser(ctx);
  const accountId = await getAuthUserId(ctx);
  const account = accountId === null ? null : await ctx.db.get("users", accountId);
  if (account === null) throw new ConvexError("Not signed in");
  return account;
}

// ─── Reads ───────────────────────────────────────────────────────────────────────────────────

/** Who a conversation is with, and the league their standings are quoted from. */
export const playerFor = internalQuery({
  args: { conversationId: v.string(), leagueTag: v.union(v.string(), v.null()) },
  returns: v.union(
    v.null(),
    v.object({
      accountId: v.id("users"),
      optIn: v.union(v.boolean(), v.null()),
      userId: v.id("users"),
      league: v.union(v.null(), v.object({ leagueId: v.id("leagues"), name: v.string() })),
    }),
  ),
  handler: async (ctx, { conversationId, leagueTag }) => {
    const account = await accountBehind(ctx, conversationId);
    if (account === null) return null;
    // Switch Player (users.demoActAs): a device acting as a seeded player also texts as them,
    // so the demo phone's proof lands on the roster that phone is showing.
    const actedAs = account.demoActAs === undefined ? null : await ctx.db.get("users", account.demoActAs);
    const player = actedAs ?? account;
    return {
      accountId: account._id,
      optIn: account.keikiOptIn ?? null,
      userId: player._id,
      league: await leagueInPlay(ctx, player._id, leagueTag),
    };
  },
});

async function accountBehind(ctx: QueryCtx, conversationId: string): Promise<Doc<"users"> | null> {
  // On the gateway, chat sets the x-conversation-id part to the player's id.
  if (conversationId.startsWith(GATEWAY_PREFIX)) {
    const userId = ctx.db.normalizeId("users", conversationId.slice(conversationId.lastIndexOf(":") + 1));
    return userId === null ? null : await ctx.db.get("users", userId);
  }
  // A phone line names it by the sender's number in E.164, which is how users.phone is stored.
  // Newest first: reinstalling the app leaves an older account on the same number.
  return await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", conversationId))
    .order("desc")
    .first();
}

/** The league the app chat is open on, or over text the one the player joined last. */
async function leagueInPlay(ctx: QueryCtx, userId: Id<"users">, leagueTag: string | null): Promise<League | null> {
  const tagged = leagueTag === null ? null : ctx.db.normalizeId("leagues", leagueTag);
  const membership =
    tagged === null
      ? await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").first()
      : await ctx.db
          .query("memberships")
          .withIndex("by_league_user", (q) => q.eq("leagueId", tagged).eq("userId", userId))
          .first();
  if (membership === null) return null;
  const league = await ctx.db.get("leagues", membership.leagueId);
  return league === null ? null : { leagueId: league._id, name: league.name };
}

/** The player's open tasks this week, sorted by what a texted photo could prove right now. */
export const proofTargets = internalQuery({
  args: { userId: v.id("users"), now: v.number() },
  returns: v.object({
    quickTime: v.union(v.null(), v.object({ taskId: v.id("tasks"), title: v.string() })),
    photoTasks: v.array(v.object({ taskId: v.id("tasks"), title: v.string() })),
    locationTasks: v.array(v.object({ taskId: v.id("tasks"), title: v.string(), placeName: v.optional(v.string()) })),
    canvasTasks: v.array(v.object({ title: v.string() })),
  }),
  handler: async (ctx, { userId, now }) => {
    const newestFirst = await ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_ROWS);

    const targets: OpenTasks = { quickTime: null, photoTasks: [], locationTasks: [], canvasTasks: [] };
    for (const task of newestFirst.reverse()) {
      // Only this week: next week's lineup can already be drafted, and last week's is settled.
      const thisWeek = task.weekStart <= now && now < task.weekStart + WEEK_MS;
      if (task.status !== "open" || !thisWeek) continue;

      if (task.proofType === "photo_location") {
        targets.locationTasks.push({ taskId: task._id, title: task.title, placeName: task.place?.name });
        continue;
      }
      if (task.proofType === "canvas") {
        targets.canvasTasks.push({ title: task.title });
        continue;
      }

      const drop = task.dropId === undefined ? null : await ctx.db.get("drops", task.dropId);
      // A drop's task can only be proved while the drop's window is open.
      if (task.dropId !== undefined && drop?.status !== "open") continue;
      if (drop?.kind === "quicktime") targets.quickTime ??= { taskId: task._id, title: task.title };
      else targets.photoTasks.push({ taskId: task._id, title: task.title });
    }
    return targets;
  },
});

/** Who the player faces in the league's current week, or null when they have no pair. */
export const opponentOf = internalQuery({
  args: { leagueId: v.id("leagues"), userId: v.id("users") },
  returns: v.union(v.null(), v.id("users")),
  handler: async (ctx, { leagueId, userId }) => {
    const week = await currentWeek(ctx, leagueId);
    if (week === null) return null;
    const pairs = await ctx.db
      .query("matchups")
      .withIndex("by_week", (q) => q.eq("weekId", week._id))
      .take(MAX_ROWS);
    // As on the Matchup tab: in an odd league one member sits in two pairs, and their own is the first.
    const pair = pairs.find((candidate) => candidate.userA === userId || candidate.userB === userId);
    if (pair === undefined) return null;
    return pair.userA === userId ? pair.userB : pair.userA;
  },
});

/** The league a drop's task scores in, or null for a task from the weekly lineup. */
export const dropLeagueOf = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.union(v.null(), v.id("leagues")),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null || task.dropId === undefined) return null;
    return (await ctx.db.get("drops", task.dropId))?.leagueId ?? null;
  },
});

/** What OPEN, PASS and IN act on: the player's sealed mystery task and the next group session. */
export const dropsFor = internalQuery({
  args: { userId: v.id("users"), now: v.number() },
  returns: v.object({
    mystery: v.union(v.null(), v.object({ dropId: v.id("drops"), title: v.string(), points: v.number() })),
    session: v.union(
      v.null(),
      v.object({ dropId: v.id("drops"), title: v.string(), placeName: v.string(), startsAt: v.number() }),
    ),
  }),
  handler: async (ctx, { userId, now }) => {
    let mystery: { dropId: Id<"drops">; title: string; points: number } | null = null;
    let session: { dropId: Id<"drops">; title: string; placeName: string; startsAt: number } | null = null;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_ROWS);
    for (const { leagueId } of memberships) {
      for (const status of ["open", "scheduled"] as const) {
        const drops = await ctx.db
          .query("drops")
          .withIndex("by_league_status", (q) => q.eq("leagueId", leagueId).eq("status", status))
          .take(MAX_ROWS);
        for (const drop of drops) {
          if (drop.kind === "mystery" && drop.userId === userId && drop.sealed && status === "open") {
            mystery ??= { dropId: drop._id, title: drop.title, points: drop.points };
          }
          const soonest = session === null || drop.opensAt < session.startsAt;
          if (drop.kind === "group" && drop.closesAt > now && soonest) {
            session = { dropId: drop._id, title: drop.title, placeName: drop.place?.name ?? "the usual spot", startsAt: drop.opensAt };
          }
        }
      }
    }
    return { mystery, session };
  },
});

export const wagerOn = internalQuery({
  args: { dropId: v.id("drops") },
  returns: v.number(),
  handler: async (ctx, { dropId }) => (await ctx.db.get("drops", dropId))?.wager ?? 0,
});

/** The phone numbers behind a send: one player's or a league's members', opted-in accounts only. */
export const phonesOf = internalQuery({
  args: { userId: v.optional(v.id("users")), leagueId: v.optional(v.id("leagues")) },
  returns: v.array(v.string()),
  handler: async (ctx, { userId, leagueId }) => {
    const players = new Set<Id<"users">>();
    if (userId !== undefined) players.add(userId);
    if (leagueId !== undefined) {
      const members = await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .take(MAX_ROWS);
      for (const member of members) players.add(member.userId);
    }

    const phones = new Set<string>();
    const addIfOptedIn = (account: Doc<"users"> | null) => {
      if (account?.phone && account.keikiOptIn === true) phones.add(account.phone);
    };
    for (const playerId of players) addIfOptedIn(await ctx.db.get("users", playerId));
    // Switch Player: a device acting as one of these players gets their texts too, or the
    // demo phone would never see the drop it is about to prove. There is no index on
    // demoActAs, and the whole users table is a hackathon's worth of rows.
    for (const account of await ctx.db.query("users").take(1000)) {
      if (account.demoActAs !== undefined && players.has(account.demoActAs)) addIfOptedIn(account);
    }
    return [...phones];
  },
});
