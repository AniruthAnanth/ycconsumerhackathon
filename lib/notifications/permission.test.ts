import { describe, expect, it, vi } from "vitest";

import { permissionStore } from "./permission";

describe("permissionStore", () => {
  it("has no answer until one is learned", () => {
    expect(permissionStore().last()).toBeUndefined();
  });

  it("gives every subscriber an answer the moment anyone learns it", () => {
    const store = permissionStore();
    const host = vi.fn(() => store.last());
    const pushSwitch = vi.fn(() => store.last());
    store.subscribe(host);
    store.subscribe(pushSwitch);

    // The grant is made from the switch; publish hands the answer back to whoever asked.
    expect(store.publish("granted")).toBe("granted");

    // Each subscriber already reads the new answer while it is being told.
    expect(host.mock.results).toEqual([{ type: "return", value: "granted" }]);
    expect(pushSwitch.mock.results).toEqual([{ type: "return", value: "granted" }]);
  });

  it("gives a late subscriber the answer learned before it arrived, without a call", () => {
    const store = permissionStore();
    store.publish("denied");
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.last()).toBe("denied");
    expect(listener).not.toHaveBeenCalled();
  });

  it("says nothing when the answer read again is the one already known", () => {
    const store = permissionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.publish("undetermined");
    // The app came back to the foreground and Settings was not touched.
    expect(store.publish("undetermined")).toBe("undetermined");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells of every change, including one back to an earlier answer", () => {
    const store = permissionStore();
    const heard: (string | undefined)[] = [];
    store.subscribe(() => heard.push(store.last()));

    // Asked after Lock Lineup, allowed, then switched off and on again in Settings.
    for (const answer of ["undetermined", "granted", "denied", "granted"] as const) store.publish(answer);

    expect(heard).toEqual(["undetermined", "granted", "denied", "granted"]);
  });

  it("stops telling a subscriber that has left, and keeps telling the rest", () => {
    const store = permissionStore();
    const gone = vi.fn();
    const staying = vi.fn();
    const leave = store.subscribe(gone);
    store.subscribe(staying);

    leave();
    store.publish("granted");

    expect(gone).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
  });

  it("still tells the rest when a subscriber leaves while it is being told", () => {
    const store = permissionStore();
    const leave = store.subscribe(() => leave());
    const staying = vi.fn();
    store.subscribe(staying);

    store.publish("granted");
    store.publish("denied");

    expect(staying).toHaveBeenCalledTimes(2);
  });

  it("keeps each store's answer and subscribers to itself", () => {
    const one = permissionStore();
    const other = permissionStore();
    const listener = vi.fn();
    other.subscribe(listener);

    one.publish("granted");

    expect(other.last()).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });
});
