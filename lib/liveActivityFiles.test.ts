import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ActivityKit pairs the app with its widget extension by the name and JSON shape of one Swift
// type. The app (a CocoaPods module) and the extension (an Xcode target) can't share a source
// file, so the type is kept in two copies. A copy that drifts still compiles and then fails
// silently on the phone: the activity starts and nothing draws. This is the check a compiler
// can't make.
describe("LineupActivityAttributes.swift", () => {
  it("is identical in the native module and in the widget extension", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path, "LineupActivityAttributes.swift"), "utf8");

    expect(read("targets/widget")).toBe(read("modules/live-activity/ios"));
  });
});
