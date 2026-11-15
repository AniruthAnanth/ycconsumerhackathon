/** What the Push row says under its title. Texts come from keiki.send, so the copy owns up to the one-alert rule. */
export function pushCopy({
  permission,
  textsOn,
  pushOn,
  hasToken,
}: {
  permission: "granted" | "denied" | "undetermined";
  textsOn: boolean;
  pushOn: boolean;
  hasToken: boolean;
}): string {
  if (permission === "denied") return "Turn on notifications for Lineup in Settings.";
  // With both on the player gets the text, not two alerts (convex/push.ts shouldPush).
  if (textsOn && pushOn) return "Texts are on, so alerts come by text and the app updates quietly.";
  if (hasToken) return "Drops, verdicts and rivals, even when Lineup is closed.";
  return "Drops, verdicts and check-ins while Lineup is open, plus your evening reminder.";
}
