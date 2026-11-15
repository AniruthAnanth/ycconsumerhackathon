import { describe, expect, it } from "vitest";

import { cameraScreen } from "./cameraScreen";

const granted = { granted: true };
const denied = { granted: false };

describe("cameraScreen", () => {
  it("shows the live camera once permission is granted", () => {
    expect(cameraScreen({ sampleMedia: false, permission: granted, cameraFailed: false })).toEqual({
      live: true,
      askPermission: false,
      samples: false,
    });
  });

  it("never offers samples without the flag, whatever the camera's state", () => {
    for (const permission of [null, denied, granted]) {
      for (const cameraFailed of [false, true]) {
        expect(cameraScreen({ sampleMedia: false, permission, cameraFailed }).samples).toBe(false);
      }
    }
  });

  it("offers samples while the flag is on", () => {
    expect(cameraScreen({ sampleMedia: true, permission: denied, cameraFailed: false }).samples).toBe(true);
  });

  it("asks for permission only once it is known to be missing", () => {
    expect(cameraScreen({ sampleMedia: false, permission: null, cameraFailed: false }).askPermission).toBe(false);
    expect(cameraScreen({ sampleMedia: false, permission: denied, cameraFailed: false }).askPermission).toBe(true);
  });

  it("drops the live camera after a failure", () => {
    expect(cameraScreen({ sampleMedia: false, permission: granted, cameraFailed: true }).live).toBe(false);
  });
});
