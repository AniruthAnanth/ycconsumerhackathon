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

// Every hour, on the hour. Who is due the evening text (from 6 PM) or the last-day text (from
// 10 AM) is decided in Pacific time inside the check-in module, so no UTC offset lives here and
// daylight saving cannot move a text into the night.
crons.cron("check-in nudges", "0 * * * *", internal.checkins.sweep, {});

// Every hour, at five past. A week ends on Monday at 00:00 Pacific, which is 08:00 UTC in winter
// and 07:00 in summer. The sweep compares each league's week with the Pacific calendar itself,
// so an hourly run closes a week within the hour in either season, and a run that finds no
// ended week does nothing.
crons.cron("week-end sweep", "5 * * * *", internal.leagues.sweepEndedWeeks, {});

export default crons;
