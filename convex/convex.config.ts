import aggregate from "@convex-dev/aggregate/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

// Every environment variable the backend reads is declared here, so modules
// read a typed `env` from "./_generated/server" instead of process.env. All are
// optional: a missing key must fail the one feature that needs it, not the
// whole deploy.
const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    SUPERMEMORY_API_KEY: v.optional(v.string()),
    WHOP_API_KEY: v.optional(v.string()),
    WHOP_ENVIRONMENT: v.optional(v.string()),
    WHOP_WEBHOOK_SECRET: v.optional(v.string()),
    KEIKI_API_KEY: v.optional(v.string()),
    // The league agent on Keiki: its id (also its model name on the API
    // gateway) and the secret Keiki signs every turn with.
    KEIKI_AGENT_ID: v.optional(v.string()),
    KEIKI_SIGNING_SECRET: v.optional(v.string()),
    // The shared iMessage number players text, and the code that connects a
    // new texter to our agent on it. Public: the app shows both.
    KEIKI_LINE_NUMBER: v.optional(v.string()),
    KEIKI_JOIN_CODE: v.optional(v.string()),
  },
});

// The leaderboards' ranked trees (convex/boardRanks.ts).
app.use(aggregate, { name: "boardRanks" });

export default app;
