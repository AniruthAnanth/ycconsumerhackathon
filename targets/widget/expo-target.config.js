// The widget extension: the second binary inside Lineup.app that draws the Live Activity on the
// lock screen and in the Dynamic Island (and later the home-screen widget). @bacons/apple-targets
// reads this file during `expo prebuild` and adds the target, with every Swift file in this
// folder, to the generated Xcode project. Nothing here is loaded by Expo Go.

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "LineupWidgets",
  bundleIdentifier: ".widgets",
};
