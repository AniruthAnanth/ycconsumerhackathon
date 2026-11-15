import { describe, expect, it } from "vitest";

import { curvePoint, escrowLayout } from "./escrowLayout";

const WIDTH = 320;

describe("escrowLayout", () => {
  it("centres the pot and splits the members between the two sides", () => {
    const layout = escrowLayout(WIDTH, 5);
    expect(layout.pot.x + layout.pot.width / 2).toBe(WIDTH / 2);
    expect(layout.lanes.filter((lane) => lane.avatar.x === 0)).toHaveLength(3);
    expect(layout.lanes.filter((lane) => lane.avatar.x === WIDTH - layout.avatarSize)).toHaveLength(2);
  });

  it("ends every line on the side of the pot its member sits on", () => {
    const { pot, lanes } = escrowLayout(WIDTH, 6);
    lanes.forEach((lane, index) => {
      expect(lane.curve.to.x).toBe(index % 2 === 0 ? pot.x : pot.x + pot.width);
      expect(lane.curve.to.y).toBeGreaterThan(pot.y);
      expect(lane.curve.to.y).toBeLessThan(pot.y + pot.height);
    });
  });

  it("grows with the league so twelve avatars never overlap", () => {
    const layout = escrowLayout(WIDTH, 12);
    const leftTops = layout.lanes.filter((_, index) => index % 2 === 0).map((lane) => lane.avatar.y);
    leftTops.slice(1).forEach((top, index) => expect(top - leftTops[index]!).toBeGreaterThanOrEqual(layout.avatarSize));
    expect(layout.height).toBeGreaterThanOrEqual(leftTops.at(-1)! + layout.avatarSize);
  });

  it("is shorter in a sheet", () => {
    expect(escrowLayout(WIDTH, 4, true).height).toBeLessThan(escrowLayout(WIDTH, 4).height);
  });

  it("still draws a pot with nobody in the league", () => {
    const layout = escrowLayout(WIDTH, 0);
    expect(layout.lanes).toEqual([]);
    expect(layout.height).toBe(layout.pot.height);
  });
});

describe("curvePoint", () => {
  it("starts beside the avatar and ends on the pot", () => {
    const { curve } = escrowLayout(WIDTH, 2).lanes[0]!;
    expect(curvePoint(curve, 0)).toEqual(curve.from);
    expect(curvePoint(curve, 1)).toEqual(curve.to);
  });

  it("passes between the two on the way", () => {
    const { curve } = escrowLayout(WIDTH, 6).lanes[4]!;
    const middle = curvePoint(curve, 0.5);
    expect(middle.x).toBeGreaterThan(curve.from.x);
    expect(middle.x).toBeLessThan(curve.to.x);
  });
});
