// The widget extension: the second binary inside Lineup.app that draws the Live Activity on the
// lock screen and in the Dynamic Island, and the home-screen widget. @bacons/apple-targets
// reads this file during `expo prebuild` and adds the target, with every Swift file in this
// folder, to the generated Xcode project. Nothing here is loaded by Expo Go.

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "LineupWidgets",
  bundleIdentifier: ".widgets",
  // The home-screen widget runs in this extension's own process and can't see the app's storage.
  // The App Group is the one container both may open: the app writes the widget's snapshot there
  // and the widget reads it. The same group is listed for the app in app.json (ios.entitlements).
  entitlements: {
    "com.apple.security.application-groups": ["group.com.lineup.app"],
  },
};
