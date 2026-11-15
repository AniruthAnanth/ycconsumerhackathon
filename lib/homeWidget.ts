import { LiveActivityNative } from "../modules/live-activity";
import type { WidgetSnapshot } from "./widgetSnapshot";

export type { WidgetSnapshot } from "./widgetSnapshot";

/**
 * The home-screen widget: my rank, points, cleared slots and next task, drawn by the widget
 * extension (targets/widget/LineupHomeWidget.swift).
 *
 * The widget is a separate process that never talks to Convex. The app hands it a snapshot
 * through the native module, which writes it to the App Group both can read and asks iOS to
 * redraw. The widget therefore shows what the app last saw, and catches up when the app opens.
 *
 * It rides on the Live Activity's native module, which exists only in a standalone iOS build.
 * In Expo Go, on Android and on the web isAvailable() is false and setSnapshot() resolves at
 * once and does nothing, and it never throws, so callers need no platform checks of their own.
 */

/**
 * True when this build can hand the widget its data. The function is checked as well as the
 * module, because a binary built before the widget existed has the module without it.
 */
export function isAvailable(): boolean {
  try {
    return typeof LiveActivityNative?.setWidgetSnapshot === "function";
  } catch {
    return false;
  }
}

/** Replaces what the widget shows and has iOS redraw it. */
export async function setSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!isAvailable()) {
    return;
  }
  try {
    await LiveActivityNative?.setWidgetSnapshot(JSON.stringify(snapshot));
  } catch {}
}
