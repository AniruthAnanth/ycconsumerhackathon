/**
 * Every recurring job in the backend is declared here, so there is one place to see what runs
 * without a player asking. The functions themselves live in the module of their domain; this
 * file only names a schedule and a function reference.
 *
 * Times are UTC. A week runs Monday to Sunday in America/Los_Angeles (UTC-8 in winter).
 */
import { cronJobs } from "convex/server";

const crons = cronJobs();

export default crons;
