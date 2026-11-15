import { OnDeviceRefereeNative } from "../modules/on-device-referee";
import { judgePhoto, type Precheck, type PrecheckTask } from "./onDeviceRefereeRules";

export type { Precheck, PrecheckTask } from "./onDeviceRefereeRules";

/**
 * The on-device referee: an instant read of a proof photo by Apple Vision, shown while the
 * photo is on its way to the server referee.
 *
 * It is a courtesy, not a judge. Only proofs.verify on the server awards points; this can at
 * most offer a Retake before a server verification is spent on a photo of the wrong thing.
 *
 * The native module exists only in a standalone iOS build, and Vision reads photos only on a
 * real iPhone. In Expo Go, on Android, on the web and on the iOS simulator isAvailable() is
 * false and precheck() resolves with NOTHING_TO_SAY, so callers need no platform checks of
 * their own.
 */

/** A read that changes nothing: no labels, no objection, no line to show. */
const NOTHING_TO_SAY: Precheck = { labels: [], likelyMatch: true, hint: "" };

/**
 * The longest the capture flow waits for Vision. A warm read takes tens of milliseconds; the
 * first one also loads the classifier. Past this the player would be waiting on a hint, so the
 * hint is dropped instead.
 */
const TIMEOUT_MS = 2000;

/** True when this build contains the native module and Vision can read a photo on this device. */
export function isAvailable(): boolean {
  return OnDeviceRefereeNative?.isSupported() ?? false;
}

/**
 * Reads the photo on the device and says whether it plausibly proves the task.
 *
 * Never throws and never takes longer than TIMEOUT_MS: when the module is missing, Vision
 * can't read the photo (the iOS simulator) or the read fails, it resolves with NOTHING_TO_SAY
 * and the capture flow carries on exactly as it would without this feature.
 */
export async function precheck(photoUri: string, task: PrecheckTask): Promise<Precheck> {
  if (!OnDeviceRefereeNative) {
    return NOTHING_TO_SAY;
  }
  try {
    if (!OnDeviceRefereeNative.isSupported()) {
      return NOTHING_TO_SAY;
    }
    // People are always counted: a person in frame is why an unusual scene is not a mismatch.
    // Hands are read only for a drop's gesture, since nothing else uses them.
    const analysis = await withTimeout(
      OnDeviceRefereeNative.analyze(photoUri, true, task.gesture != null),
      TIMEOUT_MS,
    );
    if (!analysis?.available) {
      return NOTHING_TO_SAY;
    }
    return judgePhoto(analysis, task);
  } catch {
    return NOTHING_TO_SAY;
  }
}

/** Resolves with the promise's value, or with null when it takes longer than `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
