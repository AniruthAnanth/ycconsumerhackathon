import { describe, expect, it } from "vitest";

import type { TaskVeto } from "../contract";
import {
  boardByTask,
  chipLabel,
  isQuiet,
  showsVeto,
  myStruck,
  struckBanner,
  upForVeto,
} from "./vetoLogic";

const NOW = 1_800_000_000_000;
const veto = (over: Partial<TaskVeto> = {}): TaskVeto => ({
  taskId: "t1" as TaskVeto["taskId"],
  ownerId: "maya" as TaskVeto["ownerId"],
  ownerName: "Maya",
  title: "Run 5k",
  slot: "body",
  points: 10,
  votes: 1,
  needed: 2,
  mine: false,
  canVote: true,
  struck: false,
  closesAt: NOW + 1000,
  ...over,
});
const me = "me" as TaskVeto["ownerId"];

describe("vetoLogic", () => {
  it("labels the chip: quiet until the first veto, then counted", () => {
    expect(chipLabel(veto({ votes: 0 }))).toBe("Veto");
    expect(isQuiet(veto({ votes: 0 }))).toBe(true);
    expect(chipLabel(veto())).toBe("Veto 1/2");
    expect(isQuiet(veto())).toBe(false);
    expect(chipLabel(veto({ struck: true }))).toBe("Struck");
    expect(isQuiet(veto({ votes: 0, struck: true }))).toBe(false);
  });

  it("shows the control on the opponent's side, and on mine only once struck", () => {
    expect(showsVeto("theirs", veto())).toBe(true);
    expect(showsVeto("mine", veto())).toBe(false);
    expect(showsVeto("mine", veto({ struck: true }))).toBe(true);
    expect(showsVeto("theirs", undefined)).toBe(false);
  });

  it("indexes the board by task", () => {
    expect(boardByTask([veto()]).get("t1" as TaskVeto["taskId"])?.title).toBe(
      "Run 5k",
    );
    expect(boardByTask(undefined).size).toBe(0);
  });

  it("lists only other players' open tasks that someone has vetoed", () => {
    const board = [
      veto(),
      veto({ votes: 0 }),
      veto({ ownerId: me }),
      veto({ struck: true }),
      veto({ closesAt: NOW - 1 }),
    ];
    expect(upForVeto(board, me, NOW)).toHaveLength(1);
  });

  it("finds my struck tasks", () => {
    expect(
      myStruck(
        [
          veto({ ownerId: me, struck: true }),
          veto({ struck: true }),
          veto({ ownerId: me }),
        ],
        me,
      ),
    ).toHaveLength(1);
  });

  it("words the banner", () => {
    expect(struckBanner("Run 5k")).toBe(
      "The league struck Run 5k. Swap it on Matchup.",
    );
  });
});
