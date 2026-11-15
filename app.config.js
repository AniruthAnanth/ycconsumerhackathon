// Dynamic layer over app.json for a build signed on a developer's own Mac
// (docs/demo/REAL_PHONE_NATIVE.md). With none of these variables set it returns app.json
// untouched, so Expo Go, the web build and the Revyl simulator builds are unaffected.
//
//   LINEUP_IOS_BUNDLE_ID    A bundle identifier unique to your Apple team. Apple lets only one
//                           team register com.lineup.app, so a personal team needs its own.
//   LINEUP_APPLE_TEAM_ID    Your team's 10-character id, written into the Xcode project for the
//                           app and for every extension target.
//   LINEUP_PERSONAL_TEAM=1  Drops the entitlements a free personal team can't sign.

// A free team's provisioning profile can't carry these, and one unsignable entitlement fails the
// whole build. Push is the known one; local notifications and Live Activities work without it.
const ENTITLEMENTS_A_PERSONAL_TEAM_CANNOT_SIGN = ["aps-environment"];

module.exports = ({ config }) => {
  const { LINEUP_IOS_BUNDLE_ID: bundleIdentifier, LINEUP_APPLE_TEAM_ID: appleTeamId } = process.env;
  const personalTeam = process.env.LINEUP_PERSONAL_TEAM === "1";
  if (!bundleIdentifier && !appleTeamId && !personalTeam) return config;

  const signed = {
    ...config,
    ios: {
      ...config.ios,
      ...(bundleIdentifier ? { bundleIdentifier } : {}),
      ...(appleTeamId ? { appleTeamId } : {}),
    },
  };
  if (!personalTeam) return signed;

  // Required here, not at the top, so the default path loads nothing beyond app.json.
  const { withEntitlementsPlist } = require("expo/config-plugins");
  const withoutUnsignableEntitlements = (expoConfig) =>
    withEntitlementsPlist(expoConfig, (mod) => {
      for (const key of ENTITLEMENTS_A_PERSONAL_TEAM_CANNOT_SIGN) delete mod.modResults[key];
      return mod;
    });
  // First in the list on purpose: the mod of the first plugin runs last, so this sees the
  // entitlements every other plugin (expo-notifications adds aps-environment) has written.
  return { ...signed, plugins: [withoutUnsignableEntitlements, ...(signed.plugins ?? [])] };
};
