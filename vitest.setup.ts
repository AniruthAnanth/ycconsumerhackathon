import { vi } from "vitest";

// Every Convex test harness gets the app's components, as the deployment does
// (convex/convex.config.ts). Registering them here, once, keeps each test file
// from having to know which components a module it calls happens to use.
vi.mock("convex-test", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex-test")>();
  const aggregate = (await import("@convex-dev/aggregate/test")).default;
  // Typed loosely on purpose: this only forwards to the real convexTest and hands back its harness.
  const convexTest = ((...args: Parameters<typeof actual.convexTest>) => {
    const t = (actual.convexTest as (...a: unknown[]) => ReturnType<typeof actual.convexTest>)(...args);
    aggregate.register(t as unknown as Parameters<typeof aggregate.register>[0], "boardRanks");
    return t;
  }) as typeof actual.convexTest;
  return { ...actual, convexTest };
});
