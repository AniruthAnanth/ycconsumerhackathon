import { describe, expect, it } from "vitest";

import { bucketsMentioned, CORE_SLOTS } from "./bucketMatch";

const of = (text: string) => [...bucketsMentioned(text)].sort();

describe("bucketsMentioned", () => {
  it("finds nothing in empty or unrelated text", () => {
    expect(of("")).toEqual([]);
    expect(of("um so this week I guess")).toEqual([]);
  });

  it("matches one keyword per bucket", () => {
    expect(of("hit the gym")).toEqual(["body"]);
    expect(of("finish my problem set")).toEqual(["mind"]);
    expect(of("take a nap")).toEqual(["recharge"]);
    expect(of("do the laundry")).toEqual(["chores"]);
    expect(of("call mom")).toEqual(["people"]);
  });

  it("matches stems in any form", () => {
    expect(of("running")).toEqual(["body"]);
    expect(of("lifting weights")).toEqual(["body"]);
    expect(of("reading a novel")).toEqual(["mind"]);
    expect(of("meditating")).toEqual(["recharge"]);
    expect(of("cleaning the kitchen")).toEqual(["chores"]);
    expect(of("my friends")).toEqual(["people"]);
  });

  it("is case-insensitive", () => {
    expect(of("YOGA and HOMEWORK")).toEqual(["body", "mind"]);
  });

  it("respects word boundaries", () => {
    expect(of("described")).toEqual([]);
    expect(of("gymnastics")).toEqual([]);
    expect(of("adamant")).toEqual([]);
    expect(of("thread")).toEqual([]);
    expect(of("dadaism")).toEqual([]);
  });

  it("matches across punctuation", () => {
    expect(of("gym, then dishes.")).toEqual(["body", "chores"]);
    expect(of("(sleep)")).toEqual(["recharge"]);
  });

  it("matches phrases with flexible spacing", () => {
    expect(of("dinner  with Sam")).toEqual(["people"]);
    expect(of("work-out at 7")).toEqual(["body"]);
    expect(of("problem sets")).toEqual(["mind"]);
  });

  it("finds all five in a full week", () => {
    const week = "Run three miles, study for my exam, sleep by eleven, do the dishes and call my dad.";
    expect(of(week)).toEqual([...CORE_SLOTS].sort());
  });

  it("never returns flex", () => {
    expect(bucketsMentioned("flex anything at all gym").has("flex" as never)).toBe(false);
  });
});
