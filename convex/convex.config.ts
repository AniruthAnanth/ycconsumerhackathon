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
  },
});

export default app;
