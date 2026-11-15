import { afterEach, describe, expect, it, vi } from "vitest";

import { announceLineupLocked, onLineupLocked } from "./lineupLock";

/** The module keeps its listeners for the life of the app, so each case takes its own away. */
const stops: (() => void)[] = [];
function listen(listener: () => void = vi.fn()) {
  stops.push(onLineupLocked(listener));
  return listener;
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe("announceLineupLocked", () => {
  it("is safe to call when nothing is listening, as on the web", () => {
    expect(() => announceLineupLocked()).not.toThrow();
  });

  it("tells every listener, once for each lock", () => {
    const host = listen();
    const other = listen();

    announceLineupLocked();
    announceLineupLocked();

    expect(host).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledTimes(2);
  });

  it("does not replay a lock to a listener that starts afterwards", () => {
    // A lineup locked before the host was listening is not this moment's news.
    announceLineupLocked();
    const late = listen();

    expect(late).not.toHaveBeenCalled();
  });

  it("stops telling a listener that has stopped, and keeps telling the rest", () => {
    const gone = vi.fn();
    const stop = onLineupLocked(gone);
    const staying = listen();

    stop();
    announceLineupLocked();

    expect(gone).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
  });

  it("still tells the rest when a listener stops while it is being told", () => {
    const stop = onLineupLocked(() => stop());
    const staying = listen();

    announceLineupLocked();
    announceLineupLocked();

    expect(staying).toHaveBeenCalledTimes(2);
  });

  it("tells a listener registered twice only once, and one stop is enough", () => {
    const listener = vi.fn();
    const stop = onLineupLocked(listener);
    stops.push(onLineupLocked(listener));

    announceLineupLocked();
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    announceLineupLocked();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
