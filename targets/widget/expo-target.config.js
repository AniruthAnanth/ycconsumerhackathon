// The widget extension: the second binary inside Lineup.app that draws the Live Activity on the
// lock screen and in the Dynamic Island, and the home-screen widget. @bacons/apple-targets
// reads this file during `expo prebuild` and adds the target, with every Swift file in this
// folder, to the generated Xcode project. Nothing here is loaded by Expo Go.

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LineupWidgets",
  bundleIdentifier: ".widgets",
  // The home-screen widget runs in this extension's own process and can't see the app's storage.
  // The App Group is the one container both may open: the app writes the widget's snapshot there
  // and the widget reads it. It is named after the app's bundle identifier, which differs when
  // the app is signed with a developer's own team (app.config.js); plugins/withAppGroup.js gives
  // the app the same group, and both Swift sides derive the name the same way.
  entitlements: {
    "com.apple.security.application-groups": [`group.${config.ios.bundleIdentifier}`],
  },
});
