/**
 * Every recurring job in the backend is declared here, so there is one place to see what runs
 * without a player asking. The functions themselves live in the module of their domain; this
 * file only names a schedule and a function reference.
 *
 * Times are UTC. A week runs Monday to Sunday in America/Los_Angeles (UTC-8 in winter).
 */
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// 16:00 UTC is 8 AM Pacific in winter and 9 AM in summer: "each morning" either way.
crons.cron("daily mystery task", "0 16 * * *", internal.drops.dailyMystery, {});

export default crons;
