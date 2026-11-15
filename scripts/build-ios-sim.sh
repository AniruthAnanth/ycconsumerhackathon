#!/usr/bin/env bash
# Builds a standalone iOS *simulator* app: JavaScript bundled in (no Metro at runtime) and pointed
# at the shared Convex deployment. This one script is the whole recipe, so the three callers
# (Capy's mobile build tool, Revyl proof of changes in .revyl/config.yaml, a developer's Mac)
# can't drift apart.
#
# Needs macOS with Xcode, CocoaPods and Node. Output: build/Lineup-sim.zip (a zipped .app).
set -euo pipefail

cd "$(dirname "$0")/.."

# Expo inlines EXPO_PUBLIC_* values when it bundles, so the URL must be set before the build.
export EXPO_PUBLIC_CONVEX_URL="${EXPO_PUBLIC_CONVEX_URL:-https://sensible-guineapig-9.convex.cloud}"
# CI=1 keeps expo prebuild from prompting; nobody is at this terminal.
export CI=1

echo "==> Convex URL: $EXPO_PUBLIC_CONVEX_URL, dev flags: ${EXPO_PUBLIC_DEV_FLAGS:-off}"
echo "==> node $(node --version), npm $(npm --version), $(xcodebuild -version | tr '\n' ' ')"

echo "==> Installing JavaScript dependencies"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "==> Generating the native iOS project (expo prebuild also runs pod install)"
npx expo prebuild --platform ios --clean

WORKSPACE="$(ls -d ios/*.xcworkspace | head -n 1)"
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"

# The JavaScript bundle is produced by an Xcode build phase that sources ios/.xcode.env.local,
# so this is the one place that reliably hands EXPO_PUBLIC_* values to the bundler. Passing
# every such variable through is what lets a caller turn on EXPO_PUBLIC_DEV_FLAGS=1, which a
# cloud phone needs: it has no camera, microphone or GPS (see lib/devFlags.ts).
for name in $(compgen -e | grep '^EXPO_PUBLIC_'); do
  printf 'export %s=%q\n' "$name" "${!name}" >> ios/.xcode.env.local
done

# Release, not Debug: a Debug build loads its JavaScript from a Metro server, which a cloud
# phone can't reach. Release embeds main.jsbundle in the app.
echo "==> Building $SCHEME (Release, iOS Simulator, arm64)"
mkdir -p build
if ! xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build \
  ARCHS=arm64 \
  > build/xcodebuild.log 2>&1; then
  echo "==> xcodebuild failed. Errors, then the end of the log:"
  grep -n -E "error:|\*\* BUILD FAILED" -A 3 build/xcodebuild.log | tail -n 120 || true
  tail -n 60 build/xcodebuild.log
  exit 1
fi

APP="$(ls -d ios/build/Build/Products/Release-iphonesimulator/*.app | head -n 1)"

if [ ! -f "$APP/main.jsbundle" ]; then
  echo "==> $APP has no main.jsbundle, so it is not a standalone build"
  exit 1
fi
# A warning, not a failure: a bundle format change could hide the string from grep.
if ! grep -a -q "${EXPO_PUBLIC_CONVEX_URL#https://}" "$APP/main.jsbundle"; then
  echo "==> WARNING: the Convex URL was not found in main.jsbundle; the app may not reach the backend"
fi

rm -f build/Lineup-sim.zip
ditto -c -k --sequesterRsrc --keepParent "$APP" build/Lineup-sim.zip
echo "==> Built build/Lineup-sim.zip from $APP ($(du -sh "$APP" | cut -f1))"
