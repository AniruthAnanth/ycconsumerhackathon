/**
 * The device side of Lineup's notifications: the only file that touches expo-notifications.
 *
 * Everything here is feature-detected and never throws. On the web, and in any build whose
 * binary lacks the native half, isAvailable() is false and every call resolves having done
 * nothing, so callers need no platform checks of their own (the same bargain as
 * lib/onDeviceReferee.ts). Expo Go contains expo-notifications, so local notifications work
 * there; what Expo Go and simulators can't supply is a push token, and expoPushToken() then
 * resolves with null.
 */
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { LogBox, Platform } from "react-native";

import {
  CHECK_IN_ACTION,
  CHECK_IN_CATEGORY,
  PASS_ACTION,
  type LineupNotification,
} from "@/convex/lib/notificationContent";

import { permissionStore, type Permission } from "./permission";
import { incomingOf, urlToOpen, type Incoming, type Presentation } from "./rules";

type ExpoNotifications = typeof import("expo-notifications");

/**
 * In Expo Go the package warns, as it loads, that push needs a development build. Lineup only
 * uses what Expo Go does support (local notifications), and the warning would otherwise sit on
 * the screen of the phone the demo runs on. It still reaches the terminal.
 */
const EXPO_GO_WARNING = "`expo-notifications` functionality is not fully supported in Expo Go";

/**
 * Loaded with require rather than import: the package looks up its native modules as it loads
 * and throws when the binary has none, and an import would take the whole app down with it.
 */
function load(): ExpoNotifications | null {
  if (Platform.OS === "web") return null;
  try {
    LogBox.ignoreLogs([EXPO_GO_WARNING]);
    return require("expo-notifications") as ExpoNotifications;
  } catch {
    return null;
  }
}

const Notifications = load();

/** True when this build can raise a notification at all. */
export function isAvailable(): boolean {
  return Notifications !== null;
}

// ─── Permission ──────────────────────────────────────────────────────────────────────────────

export type { Permission };

/**
 * The app's one copy of the system's answer (see permission.ts). getPermission() and
 * requestPermission() publish whatever they learn, whoever called them, so the answer to a
 * dialog raised from one screen reaches every other screen that depends on it.
 */
const permission = permissionStore();

/** The answer as last learned, or undefined before it has been read. Never asks the system. */
export const lastPermission = permission.last;

/** Calls `listener` whenever the answer changes. Returns the function that stops listening. */
export const onPermission = permission.subscribe;

type PermissionAnswer = Awaited<ReturnType<ExpoNotifications["getPermissionsAsync"]>>;

function permissionOf(answer: PermissionAnswer): Permission {
  // iOS can grant "provisional" delivery, which reports granted: false but does deliver.
  const provisional = answer.ios?.status === Notifications?.IosAuthorizationStatus.PROVISIONAL;
  return answer.granted || provisional ? "granted" : answer.status === "undetermined" ? "undetermined" : "denied";
}

/** What the system currently allows. Never shows a dialog. */
export async function getPermission(): Promise<Permission> {
  if (!Notifications) return "denied";
  try {
    return permission.publish(permissionOf(await Notifications.getPermissionsAsync()));
  } catch {
    return permission.publish("denied");
  }
}

/** Shows the system's permission dialog if it has never been answered, and returns the answer. */
export async function requestPermission(): Promise<Permission> {
  if (!Notifications) return "denied";
  try {
    return permission.publish(
      permissionOf(
        await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }),
      ),
    );
  } catch {
    return permission.publish("denied");
  }
}

/**
 * Whether Lineup may raise anything right now: the system allows it and the player has not
 * switched Push off. The notifications host keeps this current; raise() and syncScheduled()
 * honour it, so a caller elsewhere in the app (the arrival prompt) needs to know neither fact.
 */
let enabled = false;

export function setEnabled(value: boolean): void {
  enabled = value;
}

// ─── Raising ─────────────────────────────────────────────────────────────────────────────────

/**
 * Registers the Check In and Pass buttons. Categories live in the system once set, so this
 * runs once per launch, before the first notification that could carry them.
 */
let buttonsReady: Promise<void> | null = null;

function registerButtons(module: ExpoNotifications): Promise<void> {
  buttonsReady ??= module
    .setNotificationCategoryAsync(CHECK_IN_CATEGORY, [
      { identifier: CHECK_IN_ACTION, buttonTitle: "Check In", options: { opensAppToForeground: true } },
      // Pass is answered from the banner: it must not pull the player into the app.
      { identifier: PASS_ACTION, buttonTitle: "Pass", options: { opensAppToForeground: false } },
    ])
    .then(
      () => undefined,
      () => undefined,
    );
  return buttonsReady;
}

/** `planned` marks a reminder as syncScheduled's own, so it never cancels anything else that is pending. */
function contentOf(notification: LineupNotification, planned = false) {
  return {
    title: notification.title,
    body: notification.body,
    // The same three fields convex/push.ts sends, so a tap is handled one way for both.
    data: { id: notification.id, kind: notification.kind, url: notification.url, ...(planned ? { planned } : {}) },
    sound: true,
    categoryIdentifier: notification.category,
  };
}

/**
 * Shows a notification now. Its id is the system identifier too, so raising the same event
 * twice replaces the first copy instead of stacking a second.
 */
export async function raise(notification: LineupNotification): Promise<void> {
  if (!Notifications || !enabled) return;
  try {
    await registerButtons(Notifications);
    await Notifications.scheduleNotificationAsync({
      identifier: notification.id,
      content: contentOf(notification),
      trigger: null,
    });
  } catch {
    // A notification that can't be shown is not worth an error on screen.
  }
}

/**
 * Makes the pending local reminders exactly `planned`: schedules what is missing, cancels what
 * is no longer wanted, and leaves alone what is already pending with the same words. Reminders
 * scheduled here fire even after the app is closed, with no push service involved.
 */
export async function syncScheduled(planned: (LineupNotification & { fireAt: number })[]): Promise<void> {
  if (!Notifications) return;
  try {
    const wanted = new Map((enabled ? planned : []).map((notification) => [notification.id, notification]));
    for (const pending of await Notifications.getAllScheduledNotificationsAsync()) {
      if (pending.content.data?.planned !== true) continue;
      const same = wanted.get(pending.identifier);
      if (same && pending.content.title === same.title && pending.content.body === same.body) {
        wanted.delete(pending.identifier);
      } else {
        await Notifications.cancelScheduledNotificationAsync(pending.identifier);
      }
    }
    if (wanted.size > 0) await registerButtons(Notifications);
    for (const notification of wanted.values()) {
      await Notifications.scheduleNotificationAsync({
        identifier: notification.id,
        content: contentOf(notification, true),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notification.fireAt },
      });
    }
  } catch {
    // As in raise(): a reminder that can't be scheduled is silently skipped.
  }
}

/**
 * Shows a notification after a short wait, whatever the app is doing by then, and resolves
 * with whether it will appear. This is for an action the player took on purpose (the demo's
 * preview), so unlike raise() it asks for permission when that was never answered, and it
 * does not consult the Push switch.
 */
export async function raiseAfter(notification: LineupNotification, seconds: number): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const allowed = await getPermission();
    if ((allowed === "undetermined" ? await requestPermission() : allowed) !== "granted") return false;
    await registerButtons(Notifications);
    await Notifications.scheduleNotificationAsync({
      identifier: notification.id,
      content: contentOf(notification),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Receiving ───────────────────────────────────────────────────────────────────────────────

/**
 * Decides how each notification is shown while the app is open (local or pushed alike). Without
 * a handler iOS shows nothing in the foreground.
 */
export function presentInForeground(decide: (incoming: Incoming) => Presentation): void {
  Notifications?.setNotificationHandler({
    handleNotification: async (notification) => {
      const how = decide(incomingOf(notification.request.content.data));
      return {
        shouldShowBanner: how === "alert",
        shouldShowList: how !== "none",
        shouldPlaySound: how === "alert",
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Calls `open` with the screen to show whenever the player taps a notification or its Check In
 * button, including the tap that launched the app. Returns the function that stops listening.
 */
export function onOpen(open: (url: string) => void): () => void {
  if (!Notifications) return () => {};
  const module = Notifications;
  // The tap that launched the app is reported both as the last response and to the listener.
  let handled: string | null = null;

  const respond = (response: ReturnType<ExpoNotifications["getLastNotificationResponse"]>) => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
    if (key === handled) return;
    handled = key;
    const url = urlToOpen(response.actionIdentifier, incomingOf(response.notification.request.content.data));
    if (url !== null) open(url);
    try {
      module.clearLastNotificationResponse();
    } catch {
      // Nothing to clear.
    }
  };

  try {
    respond(module.getLastNotificationResponse());
    const subscription = module.addNotificationResponseReceivedListener(respond);
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

// ─── Push token ──────────────────────────────────────────────────────────────────────────────

/** A simulator can leave the token request pending for ever; a real phone answers in a second or two. */
const TOKEN_TIMEOUT_MS = 10 * 1000;

/**
 * This device's Expo push token, or null when one can't be had: Expo Go (which has had no
 * remote push since SDK 53), no EAS project id in the app config (which is how Expo's push
 * service knows whose app the token belongs to), a simulator, or a build signed without the
 * push entitlement. Null is the normal case today, and it only means the backend has nowhere
 * to push; local notifications are unaffected.
 */
export async function expoPushToken(): Promise<string | null> {
  if (!Notifications || isRunningInExpoGo()) return null;
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== "string" || projectId === "") return null;
  try {
    const token = await Promise.race([
      Notifications.getExpoPushTokenAsync({ projectId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)),
    ]);
    return token?.data ?? null;
  } catch {
    return null;
  }
}
