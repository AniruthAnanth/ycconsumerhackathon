#!/usr/bin/env node
// Answers one question: can this app still be opened in Expo Go from a QR code, or has a
// dependency crept in that forces a custom development build (which needs the owner's Apple
// account and time we don't have)?
//
// Expo Go ships a fixed set of native modules. JavaScript-only packages always work. A package
// with native iOS code works only if Expo Go already contains it. Expo records the native
// packages it knows for an SDK in expo/bundledNativeModules.json; a few of those are still
// absent from Expo Go, so they are listed by hand below.
//
// Usage: node scripts/check-expo-go.mjs   (after npm install; exits 1 when a custom build is forced)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// Known to Expo's version list but not present in the Expo Go app.
const NOT_IN_EXPO_GO = new Set([
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-speech-recognition",
  "@react-native-voice/voice",
  "react-native-vision-camera",
  "react-native-mmkv",
  "react-native-watch-connectivity",
  "react-native-purchases",
  "react-native-nitro-modules",
  "@react-native-firebase/app",
  "react-native-ble-plx",
  "react-native-health",
  "expo-widgets",
  "expo-app-integrity",
]);

// These ship inside Expo Go even though they are not Expo packages.
const IN_EXPO_GO_ANYWAY = new Set(["expo", "react-native", "react-native-web"]);

function hasNativeIosCode(packageDir) {
  if (!existsSync(packageDir)) return false;
  const entries = readdirSync(packageDir);
  return (
    entries.some((name) => name.endsWith(".podspec")) ||
    entries.includes("expo-module.config.json") ||
    existsSync(join(packageDir, "ios"))
  );
}

const pkg = readJson(join(root, "package.json"));
const dependencies = Object.keys({ ...pkg.dependencies });

if (!existsSync(join(root, "node_modules", "expo", "bundledNativeModules.json"))) {
  console.error("Run npm install first: node_modules/expo is missing.");
  process.exit(2);
}
// A dependency that is listed but not installed has no folder to inspect and would pass unseen,
// which is exactly the case after a pull that added a native package.
const notInstalled = dependencies.filter((name) => !existsSync(join(root, "node_modules", name)));
if (notInstalled.length > 0) {
  console.error(`Run npm ci first: package.json lists packages that are not installed, so they can't be checked: ${notInstalled.join(", ")}`);
  process.exit(2);
}
const bundled = readJson(join(root, "node_modules", "expo", "bundledNativeModules.json"));
const expoVersion = readJson(join(root, "node_modules", "expo", "package.json")).version;

const forcesCustomBuild = [];
const nativeAndFine = [];
for (const name of dependencies) {
  if (!hasNativeIosCode(join(root, "node_modules", name))) continue;
  const inExpoGo = (name in bundled || IN_EXPO_GO_ANYWAY.has(name)) && !NOT_IN_EXPO_GO.has(name);
  (inExpoGo ? nativeAndFine : forcesCustomBuild).push(name);
}

console.log(`Expo SDK ${expoVersion.split(".")[0]} (expo ${expoVersion}). Expo Go from the App Store must support this SDK.`);
console.log(`Native modules already inside Expo Go (${nativeAndFine.length}): ${nativeAndFine.join(", ") || "none"}`);

// Local Expo modules (modules/<name>) carry native code that only a standalone build contains.
// They are fine as long as their JavaScript loads them with requireOptionalNativeModule, which
// returns null in Expo Go; a hard requireNativeModule would crash there.
const localModulesDir = join(root, "modules");
const localModules = existsSync(localModulesDir) ? readdirSync(localModulesDir) : [];
for (const name of localModules) {
  const entry = join(localModulesDir, name, "index.ts");
  const source = existsSync(entry) ? readFileSync(entry, "utf8") : "";
  if (/\brequireNativeModule\b/.test(source)) {
    forcesCustomBuild.push(`modules/${name} (uses requireNativeModule; make it requireOptionalNativeModule)`);
  } else {
    console.log(`Local module modules/${name}: absent in Expo Go by design, its feature is skipped there.`);
  }
}

if (forcesCustomBuild.length > 0) {
  console.error(`\nCUSTOM BUILD FORCED by: ${forcesCustomBuild.join(", ")}`);
  console.error("These have native code that Expo Go does not contain. Tell the owner now, or replace them.");
  process.exit(1);
}
console.log("\nOK: every native dependency is inside Expo Go. The app opens from a QR code.");
