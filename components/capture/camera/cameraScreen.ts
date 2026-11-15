import type { PermissionResponse } from "expo-camera";

type Inputs = {
  sampleMedia: boolean;
  /** Null until expo-camera has read the permission, which is every camera open's first render. */
  permission: Pick<PermissionResponse, "granted"> | null;
  cameraFailed: boolean;
};

/** What the proof camera draws for the current permission, failure and development-flag state. */
export function cameraScreen({ sampleMedia, permission, cameraFailed }: Inputs) {
  return {
    live: permission?.granted === true && !cameraFailed,
    askPermission: permission !== null && !permission.granted,
    // Bundled samples would earn real points from the real referee, so only the development flag shows them.
    samples: sampleMedia,
  };
}
