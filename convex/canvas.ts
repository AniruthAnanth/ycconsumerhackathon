/**
 * Canvas proofs: coursework that proves itself.
 *
 * A task with proofType "canvas" needs no photo. The player connects Canvas
 * once (their school's address plus a personal access token), and verifying
 * the task asks Canvas whether that assignment was handed in.
 *
 * The one rule that shapes this file: the access token lets anyone act as the
 * student, so it never leaves the server. It is read only through the internal
 * query below, no public function returns it, and no error message or log line
 * mentions it.
 *
 * Reading order: plain rules (pure, unit-tested), then the two "schools" that
 * answer for a connection (real Canvas over HTTP, and a built-in demo school so
 * the demo runs without anyone's token), then the Convex functions.
 *
 * Canvas REST API reference: https://canvas.instructure.com/doc/api/
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/auth";
import { MAX_FLEX_TASKS, tidyTask } from "./lib/lineupRules";
import { rejectWithoutJudging, type Verdict } from "./lib/verdict";
import {
  HOUR_MS,
  clockLabel,
  weekEndOf,
  weekStartOf,
  weekdayLabel,
} from "./lib/week";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Saving this as the school address connects the built-in demo school. */
export const DEMO_BASE_URL = "demo";

/**
 * Canvas ids are 64-bit and exceed what a JavaScript number holds exactly on
 * some instances, so they stay strings from the HTTP response to the task row.
 */
export type CanvasIds = { courseId: string; assignmentId: string };

export type CanvasAssignment = CanvasIds & {
  courseName: string;
  title: string;
  dueAt?: number; // epoch ms; absent when the assignment has no due date
};

/** The two fields of Canvas's Submission object we judge by, under Canvas's own names. */
export type CanvasSubmission = {
  workflow_state: string; // "submitted" | "unsubmitted" | "graded" | "pending_review"
  submitted_at: string | null; // ISO 8601; null when nothing was handed in
};

type CanvasConnection = { baseUrl: string; token: string };

/** What verify needs from a school, whether it is real Canvas or the demo. */
export type CanvasSchool = {
  /**
   * "upcoming" is what the Connect Canvas screen offers; "all" also covers
   * assignments whose due date has passed, for matching a task by its title.
   */
  assignments(which: "upcoming" | "all"): Promise<CanvasAssignment[]>;
  submission(ids: CanvasIds): Promise<CanvasSubmission>;
};

// ---------------------------------------------------------------------------
// Rules (pure)
// ---------------------------------------------------------------------------

/**
 * Reduces whatever the player pasted ("canvas.school.edu", a link copied from
 * a course page, "http://...") to "https://<host>".
 *
 * Only the host survives because the token is sent to this address: forcing
 * https keeps it off the wire in clear text, and dropping the path, query and
 * any "user@" part means a pasted link can't steer requests anywhere but the
 * Canvas API root of that host.
 */
export function normaliseBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.toLowerCase() === DEMO_BASE_URL) {
    return DEMO_BASE_URL;
  }
  const host = trimmed
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  // A real domain name: dotted labels ending in a top-level domain, optional
  // port. This also turns away bare IP addresses and internal host names.
  if (!/^([a-z0-9-]+\.)+[a-z][a-z0-9-]*(:\d+)?$/.test(host)) {
    throw new ConvexError(
      "Enter your school's Canvas address, like canvas.stanford.edu.",
    );
  }
  return `https://${host}`;
}

/**
 * Whether the student handed something in.
 *
 * submitted_at is the evidence, not workflow_state: a teacher can grade an
 * assignment nobody submitted (a zero for missing work, or a grade for
 * something handed in on paper), which makes it "graded" with submitted_at
 * null. "graded" and "pending_review" with a submitted_at do count, since the
 * work was handed in and has merely moved on to marking.
 */
export function isSubmitted(
  submission: CanvasSubmission,
): submission is CanvasSubmission & { submitted_at: string } {
  return (
    submission.workflow_state !== "unsubmitted" &&
    typeof submission.submitted_at === "string" &&
    !Number.isNaN(Date.parse(submission.submitted_at))
  );
}

/**
 * Finds the assignment a task means when the task carries no Canvas ids,
 * which is the case for tasks the voice draft wrote ("Finish problem set 6").
 *
 * An exact title wins. Otherwise one title has to appear inside the other as
 * whole words, so "Problem Set 6" never matches "Problem Set 60", and the
 * longest such assignment title wins because it is the most specific.
 * Case, punctuation and spacing are ignored.
 */
export function matchAssignmentByTitle(
  taskTitle: string,
  assignments: CanvasAssignment[],
): CanvasAssignment | null {
  const wanted = comparableWords(taskTitle);
  if (wanted === "") {
    return null;
  }
  let best: CanvasAssignment | null = null;
  let bestLength = 0;
  for (const assignment of assignments) {
    const title = comparableWords(assignment.title);
    if (title === "") {
      continue;
    }
    if (title === wanted) {
      return assignment;
    }
    const oneInsideTheOther =
      ` ${wanted} `.includes(` ${title} `) ||
      ` ${title} `.includes(` ${wanted} `);
    if (oneInsideTheOther && title.length > bestLength) {
      best = assignment;
      bestLength = title.length;
    }
  }
  return best;
}

function comparableWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The verdict for a definite answer from Canvas. Confidence is 1 and closeCall
 * is false because this is a record lookup, not a judgement: there is nothing
 * for the league to second-guess.
 *
 * The reason is what the player reads on the verdict screen, so it names the
 * assignment and, on a pass, when Canvas says it was handed in.
 */
export function verdictFor(
  task: { title: string; points: number },
  submission: CanvasSubmission,
): Verdict {
  if (!isSubmitted(submission)) {
    return {
      pass: false,
      confidence: 1,
      reason: `Canvas shows no submission for ${task.title} yet.`,
      highlight: 1,
      caption: `${task.title} is still open on Canvas.`,
      points: 0,
      closeCall: false,
    };
  }
  // Pacific time, the zone Lineup's weeks are defined in: "Sat 9:12 PM".
  const at = Date.parse(submission.submitted_at);
  return {
    pass: true,
    confidence: 1,
    reason: `Canvas shows ${task.title} submitted ${weekdayLabel(at)} ${clockLabel(at)}.`,
    highlight: 5,
    caption: `Handed in ${task.title}.`,
    points: task.points,
    closeCall: false,
  };
}

// ---------------------------------------------------------------------------
// Schools: who answers for a connection
// ---------------------------------------------------------------------------

/** The one place that decides between real Canvas and the demo school. */
export function schoolFor(
  connection: CanvasConnection,
  now: number,
): CanvasSchool {
  return connection.baseUrl === DEMO_BASE_URL
    ? demoSchool(now)
    : canvasSchool(connection);
}

/**
 * The demo school's coursework. Times are offsets from "now" so the list
 * always looks like this week's work. One assignment is deliberately not
 * handed in, so a demo can show a failing verdict as well as passing ones.
 */
const DEMO_ASSIGNMENTS = [
  {
    courseId: "demo-cs161",
    assignmentId: "demo-ps6",
    courseName: "CS 161: Design and Analysis of Algorithms",
    title: "Problem Set 6",
    dueInHours: 6,
    submittedHoursAgo: 16,
  },
  {
    courseId: "demo-pwr2",
    assignmentId: "demo-essay-draft",
    courseName: "PWR 2: Writing and Rhetoric",
    title: "Research Essay Draft",
    dueInHours: 9,
    submittedHoursAgo: 3,
  },
  {
    courseId: "demo-econ1",
    assignmentId: "demo-reading-7",
    courseName: "ECON 1: Principles of Economics",
    title: "Reading Response 7",
    dueInHours: 28,
    submittedHoursAgo: 41,
  },
  {
    courseId: "demo-cs161",
    assignmentId: "demo-quiz4",
    courseName: "CS 161: Design and Analysis of Algorithms",
    title: "Quiz 4: Dynamic Programming",
    dueInHours: 33,
    submittedHoursAgo: 1,
  },
  {
    courseId: "demo-math51",
    assignmentId: "demo-hw8",
    courseName: "MATH 51: Linear Algebra",
    title: "Homework 8",
    dueInHours: 52,
    submittedHoursAgo: null,
  },
] as const;

export function demoSchool(now: number): CanvasSchool {
  // Sunday 23:59 of the week being played. Due dates are capped here so every
  // demo assignment belongs to that week, however late in it the demo runs.
  const weekEndsAt = weekEndOf(weekStartOf(now)) - 60 * 1000;
  return {
    async assignments() {
      return DEMO_ASSIGNMENTS.map((demo) => ({
        courseId: demo.courseId,
        assignmentId: demo.assignmentId,
        courseName: demo.courseName,
        title: demo.title,
        dueAt: Math.min(now + demo.dueInHours * HOUR_MS, weekEndsAt),
      })).sort(byDueDate);
    },
    async submission({ courseId, assignmentId }) {
      const demo = DEMO_ASSIGNMENTS.find(
        (each) =>
          each.courseId === courseId && each.assignmentId === assignmentId,
      );
      if (demo === undefined) {
        throw new ConvexError(ASSIGNMENT_NOT_FOUND);
      }
      if (demo.submittedHoursAgo === null) {
        return { workflow_state: "unsubmitted", submitted_at: null };
      }
      return {
        workflow_state: "submitted",
        submitted_at: new Date(
          now - demo.submittedHoursAgo * HOUR_MS,
        ).toISOString(),
      };
    },
  };
}

const ASSIGNMENT_NOT_FOUND =
  "Canvas can't find that assignment on this account.";

/** Real Canvas, over its REST API, as the connected student. */
export function canvasSchool(connection: CanvasConnection): CanvasSchool {
  const host = connection.baseUrl.replace("https://", "");

  // Every failure becomes a short ConvexError the player can read. The
  // messages are written here, never taken from the caught error or the
  // response, so nothing that travelled with the request (the token) can end
  // up in one.
  const get = async (path: string, notFound: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetch(`${connection.baseUrl}/api/v1${path}`, {
        headers: {
          Authorization: `Bearer ${connection.token}`,
          // Asks Canvas to send every id as a string; as JSON numbers the
          // large ones would be rounded on parsing.
          Accept: "application/json+canvas-string-ids",
        },
      });
    } catch {
      throw new ConvexError(
        `Couldn't reach Canvas at ${host}. Check the address and try again.`,
      );
    }
    if (response.status === 401) {
      throw new ConvexError(
        "Canvas rejected the access token. Reconnect Canvas with a new one.",
      );
    }
    if (response.status === 404) {
      throw new ConvexError(notFound);
    }
    if (!response.ok) {
      throw new ConvexError(
        `Canvas answered with an error (${response.status}). Try again in a minute.`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new ConvexError(`${host} didn't answer like a Canvas site.`);
    }
  };

  return {
    async assignments(which) {
      // Courses the player is currently taking as a student: only those have
      // submissions of theirs to check.
      const courses = jsonRows(
        await get(
          "/courses?enrollment_state=active&enrollment_type=student&per_page=50",
          `${host} didn't answer like a Canvas site.`,
        ),
      );
      // Canvas's "upcoming" bucket is assignments due within the next week,
      // which is exactly the week a player is drafting for.
      const bucket = which === "upcoming" ? "bucket=upcoming&" : "";
      const perCourse = await Promise.allSettled(
        courses.map(async (course) => {
          const courseId = String(course.id);
          const assignments = jsonRows(
            await get(
              `/courses/${encodeURIComponent(courseId)}/assignments?${bucket}order_by=due_at&per_page=50`,
              ASSIGNMENT_NOT_FOUND,
            ),
          );
          return assignments.map((assignment): CanvasAssignment => {
            const dueAt =
              typeof assignment.due_at === "string"
                ? Date.parse(assignment.due_at)
                : Number.NaN;
            return {
              courseId,
              assignmentId: String(assignment.id),
              // Canvas withholds the name of a course whose dates restrict access.
              courseName:
                typeof course.name === "string" ? course.name : "Course",
              title:
                typeof assignment.name === "string"
                  ? assignment.name
                  : "Untitled assignment",
              ...(Number.isNaN(dueAt) ? {} : { dueAt }),
            };
          });
        }),
      );
      // One course that won't list its assignments (concluded early, access
      // restricted) shouldn't hide the rest. If none answered, the problem is
      // the connection, and the player should hear about it.
      const answered = perCourse.filter((result) => result.status === "fulfilled");
      const firstFailure = perCourse.find((result) => result.status === "rejected");
      if (answered.length === 0 && firstFailure !== undefined) {
        throw firstFailure.reason;
      }
      return answered.flatMap((result) => result.value).sort(byDueDate);
    },

    async submission({ courseId, assignmentId }) {
      // "self" is Canvas's documented stand-in for the id of the user the
      // token belongs to, which saves a request to look that id up.
      const submission = await get(
        `/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions/self`,
        ASSIGNMENT_NOT_FOUND,
      );
      const fields = (submission ?? {}) as Record<string, unknown>;
      return {
        workflow_state:
          typeof fields.workflow_state === "string"
            ? fields.workflow_state
            : "unsubmitted",
        submitted_at:
          typeof fields.submitted_at === "string" ? fields.submitted_at : null,
      };
    },
  };
}

/** A Canvas list response as loosely typed rows; anything else counts as empty. */
function jsonRows(json: unknown): Record<string, unknown>[] {
  return Array.isArray(json)
    ? json.filter((row) => typeof row === "object" && row !== null)
    : [];
}

/** Soonest first; assignments with no due date go last. */
function byDueDate(a: CanvasAssignment, b: CanvasAssignment): number {
  return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
}

// ---------------------------------------------------------------------------
// Internal functions: the only code that touches canvasConnections
// ---------------------------------------------------------------------------

const verdictValidator = v.object({
  pass: v.boolean(),
  confidence: v.number(),
  reason: v.string(),
  highlight: v.number(),
  caption: v.string(),
  points: v.number(),
  closeCall: v.boolean(),
});

const canvasIdsValidator = v.object({
  courseId: v.string(),
  assignmentId: v.string(),
});

const connectionValidator = v.object({
  baseUrl: v.string(),
  token: v.string(),
});

async function connectionOf(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<CanvasConnection | null> {
  const row = await ctx.db
    .query("canvasConnections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return row === null ? null : { baseUrl: row.baseUrl, token: row.token };
}

/** A player has one connection; connecting again replaces it. */
async function saveConnection(
  ctx: MutationCtx,
  userId: Id<"users">,
  connection: CanvasConnection,
): Promise<void> {
  const existing = await ctx.db
    .query("canvasConnections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing === null) {
    await ctx.db.insert("canvasConnections", { userId, ...connection });
  } else {
    await ctx.db.patch("canvasConnections", existing._id, connection);
  }
}

/**
 * The caller's connection, token included. Internal on purpose: actions need
 * the token to call Canvas, and this is the only way they get it.
 */
export const callerConnection = internalQuery({
  args: {},
  returns: v.union(v.null(), connectionValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await connectionOf(ctx, user._id);
  },
});

/**
 * Everything verify needs to know before it calls Canvas, read in one
 * transaction: that the caller owns this Canvas task, how to reach their
 * school, and the verdict already on record if the task is settled.
 */
export const verifyContext = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.object({
    task: v.object({
      title: v.string(),
      points: v.number(),
      canvas: v.optional(canvasIdsValidator),
    }),
    connection: v.union(v.null(), connectionValidator),
    recorded: v.union(v.null(), verdictValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get("tasks", args.taskId);
    // The same answer for "no such task" and "someone else's task", so task
    // ids can't be probed.
    if (task === null || task.userId !== user._id) {
      throw new ConvexError("That task isn't on your lineup.");
    }
    if (task.proofType !== "canvas") {
      throw new ConvexError("This task isn't proven through Canvas.");
    }

    // "held" is a verified task whose proof the league is voting on; it has
    // its verdict too.
    let recorded: Verdict | null = null;
    if (task.status === "verified" || task.status === "held") {
      const proofs = await ctx.db
        .query("proofs")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .order("desc")
        .take(20);
      const passed = proofs.find((proof) => proof.pass);
      if (passed !== undefined) {
        recorded = {
          pass: true,
          confidence: passed.confidence,
          reason: passed.reason,
          highlight: passed.highlight,
          caption: passed.caption,
          points: task.points,
          closeCall: false,
        };
      }
    }

    return {
      task: { title: task.title, points: task.points, canvas: task.canvas },
      connection: await connectionOf(ctx, user._id),
      recorded,
    };
  },
});

/**
 * Leaves the same trail a photo proof leaves: a proofs row for the feed and
 * standings and, on a pass, the task marked verified. A miss leaves the task
 * open, because a failed proof can be retried until the week ends.
 *
 * It mirrors proofs.record rather than calling it because that mutation
 * requires the stored photo or video, and a Canvas proof has no media.
 */
export const recordVerdict = internalMutation({
  args: {
    taskId: v.id("tasks"),
    pass: v.boolean(),
    confidence: v.number(),
    reason: v.string(),
    highlight: v.number(),
    caption: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId);
    // Two taps on Verify race each other through Canvas; only the first to
    // get here writes, so a task never collects two passing proofs.
    if (task === null || task.status !== "open") {
      return null;
    }
    await ctx.db.insert("proofs", {
      taskId: task._id,
      userId: task.userId,
      weekStart: task.weekStart,
      mediaType: "canvas",
      pass: args.pass,
      confidence: args.confidence,
      reason: args.reason,
      highlight: args.highlight,
      caption: args.caption,
      via: "canvas",
      createdAt: Date.now(),
    });
    if (args.pass) {
      await ctx.db.patch("tasks", task._id, { status: "verified" });
      // Leaderboards keep a stored copy of each player's week; this rebuilds theirs.
      await ctx.scheduler.runAfter(0, internal.leaderboards.refresh, { userId: task.userId, weekStart: task.weekStart });
    }
    return null;
  },
});

/**
 * Connects a seeded player to the demo school, so the seed can set up a
 * league where Canvas proofs work with no token.
 */
export const seedDemoConnection = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await saveConnection(ctx, args.userId, { baseUrl: DEMO_BASE_URL, token: "" });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Public functions (API.md)
// ---------------------------------------------------------------------------

/**
 * Saves the caller's Canvas connection. The token isn't checked here because
 * a mutation can't call out; a bad one is reported by the listAssignments
 * call the Connect Canvas screen makes next.
 */
export const connect = mutation({
  args: { baseUrl: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const baseUrl = normaliseBaseUrl(args.baseUrl);
    if (baseUrl === DEMO_BASE_URL) {
      await saveConnection(ctx, user._id, { baseUrl, token: "" });
      return null;
    }
    const token = args.token.trim();
    if (token === "") {
      throw new ConvexError("Paste your Canvas access token.");
    }
    await saveConnection(ctx, user._id, { baseUrl, token });
    return null;
  },
});

/** The caller's upcoming coursework, soonest first, to add as tasks. */
export const listAssignments = action({
  args: {},
  returns: v.array(
    v.object({
      courseId: v.string(),
      assignmentId: v.string(),
      courseName: v.string(),
      title: v.string(),
      dueAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx): Promise<CanvasAssignment[]> => {
    // callerConnection resolves the caller with requireUser.
    const connection: CanvasConnection | null = await ctx.runQuery(
      internal.canvas.callerConnection,
      {},
    );
    if (connection === null) {
      throw new ConvexError("Connect Canvas first.");
    }
    return await schoolFor(connection, Date.now()).assignments("upcoming");
  },
});

// The points a Canvas task starts with, the same as a typed-in flex task
// (lineup.addFlexTask): playable at once, then rated by the model on the scale
// drafted tasks use.
const UNRATED_POINTS = 20;

/**
 * Adds a Canvas assignment to the caller's current week. It takes the Mind
 * slot (school and work) while that slot is free and the lineup is still
 * being drafted, and otherwise becomes a flex task, the only kind a locked
 * lineup accepts. Week, flex limit and points follow lineup.ts, so the row is
 * the one lineup.addFlexTask would write, plus the Canvas ids.
 */
export const addTask = mutation({
  args: {
    courseId: v.string(),
    assignmentId: v.string(),
    title: v.string(),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.title.trim() === "" || args.courseId === "" || args.assignmentId === "") {
      throw new ConvexError("Pick an assignment to add.");
    }
    const weekStart = weekStartOf(Date.now());
    // A week holds a lineup of at most eight tasks plus a handful from drops.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", user._id).eq("weekStart", weekStart),
      )
      .take(100);

    // Tapping the same assignment twice shouldn't cost a second slot.
    const alreadyAdded = tasks.find(
      (task) =>
        task.canvas?.courseId === args.courseId &&
        task.canvas.assignmentId === args.assignmentId,
    );
    if (alreadyAdded !== undefined) {
      return alreadyAdded._id;
    }

    const lineup = await ctx.db
      .query("lineups")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", user._id).eq("weekStart", weekStart),
      )
      .first();
    const locked = lineup !== null && lineup.lockedAt !== undefined;
    // A drop's task scores only in that drop's league, so it doesn't occupy
    // the lineup's own Mind slot.
    const mindTaken = tasks.some(
      (task) => task.slot === "mind" && task.dropId === undefined,
    );
    const asFlex = locked || mindTaken;
    if (
      asFlex &&
      tasks.filter((task) => task.slot === "flex").length >= MAX_FLEX_TASKS
    ) {
      throw new ConvexError(
        `You already have ${MAX_FLEX_TASKS} flex tasks this week.`,
      );
    }

    const task = tidyTask({
      slot: asFlex ? "flex" : "mind",
      title: args.title,
      points: UNRATED_POINTS,
      proofType: "canvas",
    });
    const taskId = await ctx.db.insert("tasks", {
      ...task,
      userId: user._id,
      weekStart,
      canvas: { courseId: args.courseId, assignmentId: args.assignmentId },
      status: "open",
      source: asFlex ? "flex" : "draft",
    });
    // Despite its name this rates any open task; it is what gives a typed-in
    // flex task its points.
    await ctx.scheduler.runAfter(0, internal.lineup.rateFlexTask, {
      taskId,
      title: task.title,
    });
    return taskId;
  },
});

/**
 * Proves a Canvas task by asking Canvas whether the assignment was handed in.
 *
 * A definite answer, yes or no, is recorded as a proof. When Canvas can't be
 * asked (not connected, token rejected, school unreachable, no such
 * assignment), the player gets a failing verdict that says why, with
 * confidence 0 to mark it as "no answer" rather than "Canvas says no", and
 * nothing is recorded: a network blip must not show up in the league's feed
 * as a failed attempt. Verifying a task that is already verified
 * returns the verdict on record without a second proof.
 */
export const verify = action({
  args: { taskId: v.id("tasks") },
  returns: verdictValidator,
  handler: async (ctx, args): Promise<Verdict> => {
    // verifyContext resolves the caller with requireUser and checks the task
    // is theirs.
    const { task, connection, recorded } = await ctx.runQuery(
      internal.canvas.verifyContext,
      { taskId: args.taskId },
    );
    if (recorded !== null) {
      return recorded;
    }
    if (connection === null) {
      return rejectWithoutJudging("Connect Canvas to prove this task.");
    }

    let verdict: Verdict;
    try {
      const school = schoolFor(connection, Date.now());
      if (task.canvas !== undefined) {
        verdict = verdictFor(task, await school.submission(task.canvas));
      } else {
        const assignment = matchAssignmentByTitle(
          task.title,
          await school.assignments("all"),
        );
        if (assignment === null) {
          return rejectWithoutJudging(
            `Canvas has no assignment that matches "${task.title}". Add it from Connect Canvas instead.`,
          );
        }
        // Canvas's own title reads better in the reason than the player's
        // phrasing ("Finish problem set 6").
        verdict = verdictFor(
          { title: assignment.title, points: task.points },
          await school.submission(assignment),
        );
      }
    } catch (error) {
      // The schools raise ConvexErrors written for the player; anything else
      // is a bug and should surface as one.
      if (error instanceof ConvexError && typeof error.data === "string") {
        return rejectWithoutJudging(error.data);
      }
      throw error;
    }

    await ctx.runMutation(internal.canvas.recordVerdict, {
      taskId: args.taskId,
      pass: verdict.pass,
      confidence: verdict.confidence,
      reason: verdict.reason,
      highlight: verdict.highlight,
      caption: verdict.caption,
    });
    return verdict;
  },
});
