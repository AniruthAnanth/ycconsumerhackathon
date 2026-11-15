import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";

import { backend } from "./backend";

describe("backend", () => {
  // backend.contract.ts checks each binding against the generated function at the same module
  // and key. That proves nothing unless the name the binding sends is that module and key, and
  // the name is a plain string the type checker cannot see.
  it("names every function by its module and key", () => {
    for (const [module, bindings] of Object.entries(backend)) {
      for (const [name, reference] of Object.entries(bindings)) {
        expect(getFunctionName(reference)).toBe(`${module}:${name}`);
      }
    }
  });
});
