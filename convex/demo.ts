/**
 * Backend controls that exist only to run the demo and belong to no product module. The hidden
 * Demo controls screen (long-press the week label) is their only caller.
 */
import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { weekStartOf } from "./lib/week";

/** What the check-in is called wherever the demo happens. */
const PLACE_NAME = "YC office";
const CHECK_IN = { slot: "people", title: "Check in at the YC office", points: 20 } as const;

/**
 * "Pin check-in here": moves the caller's location check-in to where the phone is standing.
 *
 * A location proof passes only within 150 m of the task's pinned place, and both the seeded
 * check-in and one drafted by voice are pinned somewhere the presenter is not. This pins the
 * player's open location task for the week in play to the phone's coordinates, or adds one
 * when they have none, so the check-in can pass on stage wherever the stage is.
 */
export const pinCheckIn = mutation({
  args: { lat: v.number(), lng: v.number() },
  returns: v.id("tasks"),
  handler: async (ctx, { lat, lng }) => {
    // requireUser follows Switch Player, so a phone playing as a seeded player pins theirs.
    const me = await requireUser(ctx);
    const weekStart = weekStartOf(Date.now());
    const place = { name: PLACE_NAME, lat, lng };

    // A week holds a lineup of at most eight tasks plus a handful from drops.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) => q.eq("userId", me._id).eq("weekStart", weekStart))
      .take(100);
    // Only an open task can still be proved: "verified" is done and "failed" is a closed drop.
    const checkIn = tasks.find((task) => task.proofType === "photo_location" && task.status === "open");
    if (checkIn) {
      await ctx.db.patch("tasks", checkIn._id, { place });
      return checkIn._id;
    }
    // "flex" keeps it out of the five starter slots, which belong to the drafted lineup.
    return await ctx.db.insert("tasks", {
      ...CHECK_IN,
      userId: me._id,
      weekStart,
      proofType: "photo_location",
      place,
      status: "open",
      source: "flex",
    });
  },
});
