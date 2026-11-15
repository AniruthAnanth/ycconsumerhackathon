import type { PermissionResponse } from "expo-camera";

type Inputs = {
  sampleMedia: boolean;
  /** Null until expo-camera has read the permission, which is every camera open's first render. */
  permission: Pick<PermissionResponse, "granted"> | null;
  cameraFailed: boolean;
};

/** What the proof camera draws for the current permission, failure and development-flag state. */
export function cameraScreen({ sampleMedia, permission, cameraFailed }: Inputs) {
  const granted = permission?.granted === true;
  return {
    live: granted && !cameraFailed,
    askPermission: permission !== null && !granted,
    // Without samples to fall back on, a camera that would not start must still offer a way forward.
    unavailable: granted && cameraFailed && !sampleMedia,
    // Bundled samples would earn real points from the real referee, so only the development flag shows them.
    samples: sampleMedia,
  };
}
