// Gives the app the App Group it shares with its widget extension: the one container both
// processes may open, which is how the home-screen widget gets its numbers (lib/homeWidget.ts).
//
// A config plugin rather than a line in app.json because the group is named after the bundle
// identifier, and app.config.js swaps that identifier for a build signed with a developer's own
// Apple team. A group hard-coded as group.com.lineup.app could not be registered by that team.
// targets/widget/expo-target.config.js gives the extension the same group.
const APP_GROUPS = "com.apple.security.application-groups";

module.exports = function withAppGroup(config) {
  const group = `group.${config.ios.bundleIdentifier}`;
  const entitlements = config.ios.entitlements ?? {};
  const groups = new Set([...(entitlements[APP_GROUPS] ?? []), group]);
  return { ...config, ios: { ...config.ios, entitlements: { ...entitlements, [APP_GROUPS]: [...groups] } } };
};
