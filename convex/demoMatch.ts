/**
 * Quick match for the demo: the player lands in a league of their own with nine seeded players at
 * clearly different points in their week (5, 4, 4, 3, 3, 2, 2, 1 and 0 of 5 tasks verified, with
 * photos in the Feed). Each caller gets one such league, found again by its invite code, so a
 * second Quick match never makes another. A player with no lineup this week gets one already
 * locked, with a check-in at YC HQ in the People slot.
 */
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { addMember, ensureCurrentWeek } from "./leagues";
import type { CoreSlot } from "./lib/scoring";
import type { SeedPhotoKey } from "./lib/seedPhotos";
import { storedPhotos } from "./seed";
import { HOUR_MS, weekStartOf } from "./lib/week";

/** Y Combinator, 560 20th St, San Francisco 94107: the hackathon venue. 400 m so GPS indoors passes. */
export const YC_HQ = { name: "YC HQ", lat: 37.760796, lng: -122.38606, radiusM: 400 };

type Pick = [title: string, photo: SeedPhotoKey, caption: string];

const SLOTS: CoreSlot[] = ["body", "mind", "recharge", "chores", "people"];
const POOL: Record<CoreSlot, Pick[]> = {
  body: [
    ["Run 5k on the Embarcadero", "run", "Bay breeze and a negative split"],
    ["Leg day at the gym", "gym", "Squats done, stairs are a problem now"],
    ["Yoga class twice", "yoga", "Second class, finally touched my toes"],
    ["Bike to work", "bike", "Beat the bus by six minutes"],
    ["50 push-ups", "pushups", "Fifty, in three sets"],
  ],
  mind: [
    ["Finish the problem set", "desk", "Last proof cracked at midnight"],
    ["Ship the side project PR", "merged", "Merged, green on the first try"],
    ["Prep the pitch slides", "slides", "Ten slides, one idea each"],
    ["Journal three nights", "journal", "Three pages this week"],
    ["Read two chapters", "book", "Two chapters down"],
  ],
  recharge: [
    ["Read before bed", "book", "Phone in the other room"],
    ["Evening walk, no phone", "walk", "Sunset walk, no phone"],
    ["One night with no screens", "couch", "Tea and a blanket"],
    ["Journal before bed", "journal", "Wrote it all down"],
    ["Sunday yoga", "yoga", "Slow flow Sunday"],
  ],
  chores: [
    ["Do laundry", "laundry", "Folded, not just washed"],
    ["Clean the kitchen", "kitchen", "You can see the counter again"],
    ["Tidy my room", "room", "Floor is visible"],
    ["Laundry and fold", "laundry", "Every sock has a partner"],
    ["Deep clean the kitchen", "kitchen", "Even the oven"],
  ],
  people: [
    ["Dinner with roommates", "dinner", "Taco night for four"],
    ["Coffee with a friend", "coffee", "Two hours, two coffees"],
    ["Pickup basketball", "basketball", "Won two of three"],
    ["Dinner with family", "dinner", "Mom's dumplings"],
    ["Coffee chat with a mentor", "coffee", "Great advice on the pitch"],
  ],
};

// Done counts give a table with a clear leader, a crowded middle and someone who hasn't started.
// The avatar is one of the seed photos already in storage, by the phone it was uploaded for.
const PLAYERS = [
  { name: "Nina Okafor", phone: "+14155550201", done: 5, avatar: "+14155550101" },
  { name: "Ethan Brooks", phone: "+14155550202", done: 4, avatar: "+14155550106" },
  { name: "Sofia Rossi", phone: "+14155550203", done: 4, avatar: "+14155550102" },
  { name: "Marcus Reed", phone: "+14155550204", done: 3, avatar: "+14155550104" },
  { name: "Grace Liu", phone: "+14155550205", done: 3, avatar: "+14155550105" },
  { name: "Diego Alvarez", phone: "+14155550206", done: 2, avatar: "+14155550103" },
  { name: "Hannah Park", phone: "+14155550207", done: 2 },
  { name: "Omar Haddad", phone: "+14155550208", done: 1 },
  { name: "Chloe Bennett", phone: "+14155550209", done: 0 },
];

const OWN_LINEUP: { slot: CoreSlot; title: string; points: number; place?: typeof YC_HQ }[] = [
  { slot: "body", title: "Walk 20 minutes", points: 20 },
  { slot: "mind", title: "Read one chapter", points: 20 },
  { slot: "recharge", title: "Bed by midnight", points: 20 },
  { slot: "chores", title: "Make my bed", points: 20 },
  { slot: "people", title: "Chill with friends at YC HQ", points: 30, place: YC_HQ },
];

async function lineupFor(ctx: MutationCtx, userId: Id<"users">, weekStart: number) {
  return await ctx.db
    .query("lineups")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
    .first();
}

async function seedPlayer(
  ctx: MutationCtx,
  player: (typeof PLAYERS)[number],
  index: number,
  photos: Partial<Record<string, Id<"_storage">>>,
  now: number,
): Promise<Id<"users">> {
  const avatarStorageId = player.avatar ? photos[player.avatar] : undefined;
  const rows = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", player.phone))
    .take(5);
  const existing = rows.find((row) => row.isSeed);
  const userId =
    existing?._id ??
    (await ctx.db.insert("users", {
      name: player.name,
      phone: player.phone,
      isSeed: true,
      createdAt: now,
      ...(avatarStorageId && { avatarStorageId }),
    }));

  // Tasks belong to the player and week, so one lineup serves every demo league they sit in.
  const weekStart = weekStartOf(now);
  if ((await lineupFor(ctx, userId, weekStart)) !== null) return userId;
  await ctx.db.insert("lineups", { userId, weekStart, lockedAt: weekStart });
  for (const [slotIndex, slot] of SLOTS.entries()) {
    const [title, photo, caption] = POOL[slot][(index + slotIndex) % POOL[slot].length];
    const verified = slotIndex < player.done;
    const points = 20 + 5 * ((index + slotIndex) % 3);
    const taskId = await ctx.db.insert("tasks", {
      userId,
      weekStart,
      slot,
      title,
      points,
      proofType: "photo",
      status: verified ? "verified" : "open",
      source: "draft",
    });
    if (!verified) continue;
    const storageId = photos[photo];
    await ctx.db.insert("proofs", {
      taskId,
      userId,
      weekStart,
      ...(storageId && { storageId }),
      mediaType: "photo",
      pass: true,
      confidence: 0.92,
      reason: `Shows ${title.toLowerCase()}.`,
      highlight: 6,
      caption,
      via: "app",
      createdAt: Math.max(weekStart + HOUR_MS, now - (index * 5 + slotIndex + 1) * 2 * HOUR_MS),
    });
  }
  return userId;
}

/** Seats the caller in their own demo league and returns it; the same league on every call. */
export async function demoQuickMatch(
  ctx: MutationCtx,
  caller: Doc<"users">,
  stakeUsd: number,
): Promise<Id<"leagues">> {
  let hash = 0;
  for (const char of caller._id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const inviteCode = `QM${hash.toString(36).toUpperCase().padStart(7, "0").slice(-6)}`;
  const existing = await ctx.db
    .query("leagues")
    .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
    .first();
  if (existing !== null) {
    await addMember(ctx, existing, caller._id);
    return existing._id;
  }

  const now = Date.now();
  const photos = await storedPhotos(ctx);
  const playerIds: Id<"users">[] = [];
  for (const [index, player] of PLAYERS.entries()) playerIds.push(await seedPlayer(ctx, player, index, photos, now));

  const leagueId = await ctx.db.insert("leagues", {
    name: stakeUsd === 0 ? "Quick Match" : `Quick Match $${stakeUsd}`,
    inviteCode,
    stakeUsd,
    // Private: the regular Quick match never seats a stranger in someone's demo table.
    visibility: "private",
    maxMembers: PLAYERS.length + 1,
    createdBy: playerIds[0],
  });
  const weekStart = weekStartOf(now);
  for (const userId of playerIds) {
    await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: weekStart });
  }
  const week = await ensureCurrentWeek(ctx, leagueId);
  if (stakeUsd > 0) {
    for (const userId of playerIds) {
      await ctx.db.insert("ledger", {
        leagueId,
        weekId: week._id,
        userId,
        kind: "buy_in",
        amountUsd: stakeUsd,
        idempotencyKey: `demo:${week._id}:${userId}`,
        createdAt: weekStart,
      });
    }
  }

  if ((await lineupFor(ctx, caller._id, weekStart)) === null) {
    await ctx.db.insert("lineups", { userId: caller._id, weekStart, lockedAt: now });
    for (const task of OWN_LINEUP) {
      await ctx.db.insert("tasks", {
        userId: caller._id,
        weekStart,
        slot: task.slot,
        title: task.title,
        points: task.points,
        proofType: task.place ? "photo_location" : "photo",
        ...(task.place && { place: task.place }),
        status: "open",
        source: "draft",
      });
    }
  }

  const league = await ctx.db.get("leagues", leagueId);
  await addMember(ctx, league!, caller._id);
  return leagueId;
}
