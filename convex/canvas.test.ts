// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  canvasSchool,
  demoSchool,
  isSubmitted,
  matchAssignmentByTitle,
  normaliseBaseUrl,
  pacificWeekStart,
  unverifiable,
  verdictFor,
  type CanvasAssignment,
} from "./canvas";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 Nov 2026, 1:00 PM in Los Angeles: late in the week, like the demo.
const SUNDAY_AFTERNOON = Date.parse("2026-11-15T21:00:00Z");
const THIS_MONDAY = Date.parse("2026-11-09T08:00:00Z"); // Mon 9 Nov, 00:00 PST

describe("normaliseBaseUrl", () => {
  it("reduces what a player pastes to https and the host", () => {
    expect(normaliseBaseUrl("canvas.stanford.edu")).toBe("https://canvas.stanford.edu");
    expect(normaliseBaseUrl("  https://canvas.stanford.edu/  ")).toBe("https://canvas.stanford.edu");
    expect(normaliseBaseUrl("http://Canvas.Stanford.edu")).toBe("https://canvas.stanford.edu");
    expect(normaliseBaseUrl("https://school.instructure.com/courses/12/assignments?x=1#top")).toBe(
      "https://school.instructure.com",
    );
  });
  it("keeps the demo school's name as it is", () => {
    expect(normaliseBaseUrl(" Demo ")).toBe("demo");
  });
  it("turns away anything that isn't a plain domain name", () => {
    for (const bad of ["", "   ", "canvas", "https://", "10.0.0.1", "user:secret@canvas.school.edu", "canvas school.edu"]) {
      expect(() => normaliseBaseUrl(bad), bad).toThrow(/Canvas address/);
    }
  });
});

describe("isSubmitted", () => {
  const at = "2026-11-15T05:12:00Z";
  it("passes work that was handed in, whatever stage marking is at", () => {
    expect(isSubmitted({ workflow_state: "submitted", submitted_at: at })).toBe(true);
    expect(isSubmitted({ workflow_state: "pending_review", submitted_at: at })).toBe(true);
    expect(isSubmitted({ workflow_state: "graded", submitted_at: at })).toBe(true);
  });
  it("does not take a grade as proof: a teacher can grade work that was never handed in", () => {
    expect(isSubmitted({ workflow_state: "graded", submitted_at: null })).toBe(false);
  });
  it("fails when nothing was handed in", () => {
    expect(isSubmitted({ workflow_state: "unsubmitted", submitted_at: null })).toBe(false);
    expect(isSubmitted({ workflow_state: "unsubmitted", submitted_at: at })).toBe(false);
    expect(isSubmitted({ workflow_state: "submitted", submitted_at: "not a date" })).toBe(false);
  });
});

describe("matchAssignmentByTitle", () => {
  const assignment = (title: string): CanvasAssignment => ({
    courseId: "1",
    assignmentId: title,
    courseName: "CS 161",
    title,
  });
  const assignments = [assignment("Problem Set 60"), assignment("Problem Set 6"), assignment("Quiz 4: Dynamic Programming")];

  it("matches an exact title whatever the case and punctuation", () => {
    expect(matchAssignmentByTitle("problem set 6", assignments)?.title).toBe("Problem Set 6");
    expect(matchAssignmentByTitle("QUIZ 4 - dynamic programming!", assignments)?.title).toBe(
      "Quiz 4: Dynamic Programming",
    );
  });
  it("finds the assignment inside a spoken task title, by whole words", () => {
    expect(matchAssignmentByTitle("Finish problem set 6 for algorithms", assignments)?.title).toBe("Problem Set 6");
    expect(matchAssignmentByTitle("Finish problem set 60", assignments)?.title).toBe("Problem Set 60");
  });
  it("finds a task title that is a shortened assignment title", () => {
    expect(matchAssignmentByTitle("Quiz 4", assignments)?.title).toBe("Quiz 4: Dynamic Programming");
  });
  it("returns null when nothing matches", () => {
    expect(matchAssignmentByTitle("Lab report", assignments)).toBeNull();
    expect(matchAssignmentByTitle("  ", assignments)).toBeNull();
    expect(matchAssignmentByTitle("Problem Set 6", [])).toBeNull();
  });
});

describe("verdictFor", () => {
  const task = { title: "Problem Set 6", points: 30 };
  it("passes with the task's points and says when Canvas received it, in Pacific time", () => {
    expect(verdictFor(task, { workflow_state: "submitted", submitted_at: "2026-11-15T05:12:00Z" })).toEqual({
      pass: true,
      confidence: 1,
      reason: "Canvas shows Problem Set 6 submitted Sat 9:12 PM.",
      highlight: 5,
      caption: "Handed in Problem Set 6.",
      points: 30,
      closeCall: false,
    });
  });
  it("fails with no points and a reason that names the assignment", () => {
    expect(verdictFor(task, { workflow_state: "unsubmitted", submitted_at: null })).toEqual({
      pass: false,
      confidence: 1,
      reason: "Canvas shows no submission for Problem Set 6 yet.",
      highlight: 1,
      caption: "Problem Set 6 is still open on Canvas.",
      points: 0,
      closeCall: false,
    });
  });
});

describe("pacificWeekStart", () => {
  it("is Monday 00:00 in Los Angeles for any moment of that week", () => {
    expect(pacificWeekStart(SUNDAY_AFTERNOON)).toBe(THIS_MONDAY);
    expect(pacificWeekStart(THIS_MONDAY)).toBe(THIS_MONDAY);
    expect(pacificWeekStart(THIS_MONDAY - 1)).toBe(Date.parse("2026-11-02T08:00:00Z"));
    expect(pacificWeekStart(Date.parse("2026-11-16T07:59:59.999Z"))).toBe(THIS_MONDAY);
  });
  it("uses Monday's UTC offset in a week where the clocks change", () => {
    // Clocks went back on Sun 1 Nov 2026; that week's Monday was still on daylight time.
    expect(pacificWeekStart(Date.parse("2026-11-01T20:00:00Z"))).toBe(Date.parse("2026-10-26T07:00:00Z"));
    // Clocks went forward on Sun 8 Mar 2026; that week's Monday was on standard time.
    expect(pacificWeekStart(Date.parse("2026-03-08T19:00:00Z"))).toBe(Date.parse("2026-03-02T08:00:00Z"));
  });
});

describe("demoSchool", () => {
  const school = demoSchool(SUNDAY_AFTERNOON);

  it("lists upcoming coursework due inside the current week, soonest first", async () => {
    const assignments = await school.assignments("upcoming");
    expect(assignments.length).toBeGreaterThanOrEqual(4);
    const dueDates = assignments.map((assignment) => assignment.dueAt ?? 0);
    expect(dueDates).toEqual([...dueDates].sort((a, b) => a - b));
    for (const dueAt of dueDates) {
      expect(dueAt).toBeGreaterThan(SUNDAY_AFTERNOON);
      expect(pacificWeekStart(dueAt)).toBe(THIS_MONDAY);
    }
  });
  it("has work handed in and exactly one assignment that is not, so both verdicts can be shown", async () => {
    const assignments = await school.assignments("all");
    const submitted = await Promise.all(
      assignments.map(async (assignment) => isSubmitted(await school.submission(assignment))),
    );
    expect(submitted.filter((yes) => !yes)).toHaveLength(1);
    expect(submitted.filter((yes) => yes).length).toBeGreaterThanOrEqual(3);
  });
  it("does not know assignments from other schools", async () => {
    await expect(school.submission({ courseId: "1", assignmentId: "2" })).rejects.toThrow(/can't find that assignment/);
  });
});

describe("canvasSchool (the real Canvas client)", () => {
  const TOKEN = "7~secretTokenThatMustNeverLeak";
  const school = canvasSchool({ baseUrl: "https://canvas.school.edu", token: TOKEN });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  /** Answers each request from a path-to-response table and records what was asked. */
  function stubCanvas(routes: Record<string, () => Response>) {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const path = url.replace("https://canvas.school.edu/api/v1", "");
      const route = routes[path];
      return route === undefined ? json({ errors: [{ message: "not found" }] }, 404) : route();
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists upcoming assignments of the student's active courses with ids kept as strings", async () => {
    const fetchMock = stubCanvas({
      "/courses?enrollment_state=active&enrollment_type=student&per_page=50": () =>
        json([
          { id: "90000000000000123", name: "CS 161" },
          { id: "42", name: "ECON 1" },
        ]),
      "/courses/90000000000000123/assignments?bucket=upcoming&order_by=due_at&per_page=50": () =>
        json([
          { id: "90000000000000456", name: "Problem Set 6", due_at: "2026-11-16T07:59:00Z" },
          { id: "8", name: "Ungraded survey", due_at: null },
        ]),
      "/courses/42/assignments?bucket=upcoming&order_by=due_at&per_page=50": () =>
        json([{ id: "7", name: "Reading Response 7", due_at: "2026-11-15T23:00:00Z" }]),
    });

    expect(await school.assignments("upcoming")).toEqual([
      {
        courseId: "42",
        assignmentId: "7",
        courseName: "ECON 1",
        title: "Reading Response 7",
        dueAt: Date.parse("2026-11-15T23:00:00Z"),
      },
      {
        courseId: "90000000000000123",
        assignmentId: "90000000000000456",
        courseName: "CS 161",
        title: "Problem Set 6",
        dueAt: Date.parse("2026-11-16T07:59:00Z"),
      },
      { courseId: "90000000000000123", assignmentId: "8", courseName: "CS 161", title: "Ungraded survey" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toEqual({
        Authorization: "Bearer " + TOKEN,
        Accept: "application/json+canvas-string-ids",
      });
    }
  });

  it("drops the upcoming filter when asked for all assignments", async () => {
    const fetchMock = stubCanvas({
      "/courses?enrollment_state=active&enrollment_type=student&per_page=50": () => json([{ id: "42", name: "ECON 1" }]),
      "/courses/42/assignments?order_by=due_at&per_page=50": () => json([{ id: "7", name: "Reading Response 7" }]),
    });
    expect((await school.assignments("all")).map((assignment) => assignment.title)).toEqual(["Reading Response 7"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still lists the other courses when one refuses to list its assignments", async () => {
    stubCanvas({
      "/courses?enrollment_state=active&enrollment_type=student&per_page=50": () =>
        json([
          { id: "1", name: "Closed course" },
          { id: "42", name: "ECON 1" },
        ]),
      "/courses/1/assignments?bucket=upcoming&order_by=due_at&per_page=50": () => json({ status: "unauthorized" }, 403),
      "/courses/42/assignments?bucket=upcoming&order_by=due_at&per_page=50": () => json([{ id: "7", name: "Reading Response 7" }]),
    });
    expect((await school.assignments("upcoming")).map((assignment) => assignment.title)).toEqual(["Reading Response 7"]);
  });

  it("reads the student's own submission of one assignment", async () => {
    const fetchMock = stubCanvas({
      "/courses/42/assignments/7/submissions/self": () =>
        json({ id: "99", workflow_state: "graded", submitted_at: "2026-11-15T05:12:00Z", score: 9 }),
    });
    expect(await school.submission({ courseId: "42", assignmentId: "7" })).toEqual({
      workflow_state: "graded",
      submitted_at: "2026-11-15T05:12:00Z",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://canvas.school.edu/api/v1/courses/42/assignments/7/submissions/self");
  });

  it("keeps an id from reaching beyond its place in the URL", async () => {
    const fetchMock = stubCanvas({});
    await expect(school.submission({ courseId: "42", assignmentId: "7/../../users" })).rejects.toThrow();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://canvas.school.edu/api/v1/courses/42/assignments/7%2F..%2F..%2Fusers/submissions/self",
    );
  });

  it("explains a rejected token, an unknown assignment, an outage and a non-Canvas site without leaking the token", async () => {
    const failures: Array<[() => Response, RegExp]> = [
      [() => json({ errors: [{ message: "Invalid access token." }] }, 401), /rejected the access token/],
      [() => json({ errors: [{ message: "The specified resource does not exist." }] }, 404), /can't find that assignment/],
      [() => json({ errors: [] }, 503), /error \(503\)/],
      [() => new Response("<html>Welcome</html>", { status: 200 }), /didn't answer like a Canvas site/],
      [
        () => {
          throw new TypeError("fetch failed: Authorization: Bearer " + TOKEN);
        },
        /Couldn't reach Canvas at canvas\.school\.edu/,
      ],
    ];
    for (const [respond, message] of failures) {
      stubCanvas({ "/courses/42/assignments/7/submissions/self": respond });
      const error = await school.submission({ courseId: "42", assignmentId: "7" }).catch((caught: unknown) => caught);
      expect(String((error as { data: unknown }).data)).toMatch(message);
      expect(JSON.stringify(error) + String(error)).not.toContain(TOKEN);
    }
  });
});

describe("canvas functions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SUNDAY_AFTERNOON);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A fresh backend with one signed-in player. Convex Auth reads the user id from the identity's subject. */
  async function setUp() {
    const t = convexTest(schema, modules);
    const signIn = async (name: string) => {
      const userId = await t.run((ctx) => ctx.db.insert("users", { name }));
      return { userId, as: t.withIdentity({ subject: userId + "|session" }) };
    };
    const proofsOf = (taskId: Id<"tasks">) =>
      t.run((ctx) =>
        ctx.db
          .query("proofs")
          .withIndex("by_task", (q) => q.eq("taskId", taskId))
          .collect(),
      );
    const maya = await signIn("Maya");
    return { t, signIn, proofsOf, maya };
  }

  it("runs the demo school end to end: connect, list, add as a task, verify", async () => {
    const { t, maya, proofsOf } = await setUp();

    expect(await maya.as.mutation(api.canvas.connect, { baseUrl: "demo", token: "" })).toBeNull();
    const assignments = await maya.as.action(api.canvas.listAssignments, {});
    const problemSet = assignments.find((assignment) => assignment.title === "Problem Set 6")!;
    expect(problemSet).toMatchObject({ courseId: "demo-cs161", assignmentId: "demo-ps6" });

    const taskId = await maya.as.mutation(api.canvas.addTask, {
      courseId: problemSet.courseId,
      assignmentId: problemSet.assignmentId,
      title: problemSet.title,
    });
    expect(await t.run((ctx) => ctx.db.get("tasks", taskId))).toMatchObject({
      userId: maya.userId,
      weekStart: THIS_MONDAY,
      slot: "mind",
      source: "draft",
      proofType: "canvas",
      canvas: { courseId: "demo-cs161", assignmentId: "demo-ps6" },
      status: "open",
    });

    const verdict = await maya.as.action(api.canvas.verify, { taskId });
    expect(verdict).toEqual({
      pass: true,
      confidence: 1,
      reason: "Canvas shows Problem Set 6 submitted Sat 9:00 PM.",
      highlight: 5,
      caption: "Handed in Problem Set 6.",
      points: 30,
      closeCall: false,
    });
    expect((await t.run((ctx) => ctx.db.get("tasks", taskId)))?.status).toBe("verified");
    const proofs = await proofsOf(taskId);
    // The server's clock stamps the proof, not anything the client sent.
    expect(proofs[0].createdAt - SUNDAY_AFTERNOON).toBeLessThan(1000);
    expect(proofs).toMatchObject([
      {
        userId: maya.userId,
        weekStart: THIS_MONDAY,
        mediaType: "canvas",
        via: "canvas",
        pass: true,
        confidence: 1,
        reason: verdict.reason,
      },
    ]);

    // Verifying again answers from the record and writes nothing.
    expect(await maya.as.action(api.canvas.verify, { taskId })).toEqual(verdict);
    expect(await proofsOf(taskId)).toHaveLength(1);
  });

  it("records a miss and leaves the task open to retry", async () => {
    const { t, maya, proofsOf } = await setUp();
    await maya.as.mutation(api.canvas.connect, { baseUrl: "demo", token: "" });
    const taskId = await maya.as.mutation(api.canvas.addTask, {
      courseId: "demo-math51",
      assignmentId: "demo-hw8",
      title: "Homework 8",
    });

    const verdict = await maya.as.action(api.canvas.verify, { taskId });
    expect(verdict).toMatchObject({
      pass: false,
      confidence: 1,
      reason: "Canvas shows no submission for Homework 8 yet.",
      points: 0,
      closeCall: false,
    });
    expect((await t.run((ctx) => ctx.db.get("tasks", taskId)))?.status).toBe("open");
    expect(await proofsOf(taskId)).toMatchObject([{ pass: false, mediaType: "canvas", via: "canvas" }]);
  });

  it("matches a voice-drafted task to an assignment by title", async () => {
    const { t, maya, proofsOf } = await setUp();
    await maya.as.mutation(api.canvas.connect, { baseUrl: "demo", token: "" });
    const draftTask = (title: string) =>
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId: maya.userId,
          weekStart: THIS_MONDAY,
          slot: "mind",
          title,
          points: 40,
          proofType: "canvas",
          status: "open",
          source: "draft",
        }),
      );

    const matched = await maya.as.action(api.canvas.verify, { taskId: await draftTask("Finish the research essay draft") });
    expect(matched).toMatchObject({
      pass: true,
      points: 40,
      reason: "Canvas shows Research Essay Draft submitted Sun 10:00 AM.",
    });

    const unmatchedId = await draftTask("Organic chemistry lab report");
    const unmatched = await maya.as.action(api.canvas.verify, { taskId: unmatchedId });
    expect(unmatched).toMatchObject({ pass: false, confidence: 0, points: 0 });
    expect(unmatched.reason).toContain('no assignment that matches "Organic chemistry lab report"');
    expect(await proofsOf(unmatchedId)).toHaveLength(0);
  });

  it("puts an assignment in Mind while it is free and the lineup is unlocked, and in flex otherwise, up to three", async () => {
    const { t, maya, signIn } = await setUp();
    const add = (as: typeof maya.as, assignmentId: string) =>
      as.mutation(api.canvas.addTask, { courseId: "c", assignmentId, title: "Assignment " + assignmentId });
    const slotOf = async (taskId: Id<"tasks">) => {
      const task = await t.run((ctx) => ctx.db.get("tasks", taskId));
      return [task?.slot, task?.source];
    };

    const first = await add(maya.as, "1");
    expect(await slotOf(first)).toEqual(["mind", "draft"]);
    // The same assignment again is the same task, not a second one.
    expect(await add(maya.as, "1")).toBe(first);
    expect(await slotOf(await add(maya.as, "2"))).toEqual(["flex", "flex"]);
    await add(maya.as, "3");
    await add(maya.as, "4");
    await expect(add(maya.as, "5")).rejects.toThrow(/already have 3 flex tasks/);

    // A locked lineup only takes flex tasks, even with Mind empty.
    const sam = await signIn("Sam");
    await t.run((ctx) =>
      ctx.db.insert("lineups", { userId: sam.userId, weekStart: THIS_MONDAY, lockedAt: SUNDAY_AFTERNOON }),
    );
    expect(await slotOf(await add(sam.as, "1"))).toEqual(["flex", "flex"]);
  });

  it("only lets a task's owner verify it, and only Canvas tasks", async () => {
    const { t, maya, signIn, proofsOf } = await setUp();
    await maya.as.mutation(api.canvas.connect, { baseUrl: "demo", token: "" });
    const taskId = await maya.as.mutation(api.canvas.addTask, {
      courseId: "demo-cs161",
      assignmentId: "demo-ps6",
      title: "Problem Set 6",
    });

    const sam = await signIn("Sam");
    await sam.as.mutation(api.canvas.connect, { baseUrl: "demo", token: "" });
    await expect(sam.as.action(api.canvas.verify, { taskId })).rejects.toThrow(/isn't on your lineup/);
    await expect(t.action(api.canvas.verify, { taskId })).rejects.toThrow(/Not signed in/);
    expect(await proofsOf(taskId)).toHaveLength(0);

    const photoTaskId = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: maya.userId,
        weekStart: THIS_MONDAY,
        slot: "body",
        title: "Gym session",
        points: 30,
        proofType: "photo",
        status: "open",
        source: "draft",
      }),
    );
    await expect(maya.as.action(api.canvas.verify, { taskId: photoTaskId })).rejects.toThrow(/isn't proven through Canvas/);
  });

  it("asks a player who hasn't connected to connect, and records nothing", async () => {
    const { maya, proofsOf } = await setUp();
    await expect(maya.as.action(api.canvas.listAssignments, {})).rejects.toThrow(/Connect Canvas first/);
    const taskId = await maya.as.mutation(api.canvas.addTask, { courseId: "c", assignmentId: "1", title: "Essay" });
    expect(await maya.as.action(api.canvas.verify, { taskId })).toEqual(unverifiable("Connect Canvas to prove this task."));
    expect(await proofsOf(taskId)).toHaveLength(0);
  });

  it("keeps one connection per player and never hands the token back", async () => {
    const { t, maya, proofsOf } = await setUp();
    const TOKEN = "7~secretTokenThatMustNeverLeak";
    await maya.as.mutation(api.canvas.connect, { baseUrl: "demo", token: "" });
    const connected = await maya.as.mutation(api.canvas.connect, {
      baseUrl: "http://Canvas.School.edu/courses/1",
      token: "  " + TOKEN + "\n",
    });
    expect(await t.run((ctx) => ctx.db.query("canvasConnections").collect())).toMatchObject([
      { userId: maya.userId, baseUrl: "https://canvas.school.edu", token: TOKEN },
    ]);
    await expect(maya.as.mutation(api.canvas.connect, { baseUrl: "canvas.school.edu", token: " " })).rejects.toThrow(
      /access token/,
    );

    // Canvas now rejects the token: both actions say so in words, with no token in sight.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const taskId = await maya.as.mutation(api.canvas.addTask, { courseId: "42", assignmentId: "7", title: "Essay" });
    const verdict = await maya.as.action(api.canvas.verify, { taskId });
    const listError = await maya.as.action(api.canvas.listAssignments, {}).catch((caught: unknown) => caught);

    expect(fetchMock.mock.calls[0][0]).toBe("https://canvas.school.edu/api/v1/courses/42/assignments/7/submissions/self");
    expect(verdict).toEqual(unverifiable("Canvas rejected the access token. Reconnect Canvas with a new one."));
    expect(String(listError)).toMatch(/rejected the access token/);
    expect(JSON.stringify([connected, verdict, listError]) + String(listError)).not.toContain(TOKEN);
    expect(await proofsOf(taskId)).toHaveLength(0);
  });

  it("lets the seed connect a player to the demo school", async () => {
    const { t, maya } = await setUp();
    await t.mutation(internal.canvas.seedDemoConnection, { userId: maya.userId });
    await t.mutation(internal.canvas.seedDemoConnection, { userId: maya.userId });
    expect(await t.run((ctx) => ctx.db.query("canvasConnections").collect())).toMatchObject([
      { userId: maya.userId, baseUrl: "demo", token: "" },
    ]);
    expect(await maya.as.action(api.canvas.listAssignments, {})).not.toHaveLength(0);
  });
});
