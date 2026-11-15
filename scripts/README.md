# scripts

| Script | What it is for |
| --- | --- |
| `build-ios-sim.sh` | The one recipe for a standalone iOS Simulator build (JavaScript bundled, `EXPO_PUBLIC_CONVEX_URL` baked in). |
| `check-expo-go.mjs` | Fails when a dependency would force a custom development build, so the app keeps opening in Expo Go. |
| `slides/` | Turns raw screenshots into framed pitch slides. See `slides/README.md`. |

## The iOS Simulator build

The build is a **Release** build for the **iOS Simulator** (arm64). Release matters: a Debug build loads its JavaScript from a Metro server that a cloud phone can't reach, while Release embeds `main.jsbundle` in the app. The Convex URL defaults to the crew's shared deployment, `https://sensible-guineapig-9.convex.cloud`; set `EXPO_PUBLIC_CONVEX_URL` before the script to point somewhere else.

What the script does, in order: `npm ci`, `npx expo prebuild --platform ios --clean` (generates `ios/` and runs `pod install`), writes the URL into `ios/.xcode.env.local` so the bundling build phase sees it, `xcodebuild -configuration Release -sdk iphonesimulator ARCHS=arm64`, checks the app contains `main.jsbundle`, and zips the `.app` to `build/Lineup-sim.zip`.

There are three ways to run it. All three run the same script.

### 1. From a Capy thread, on a Revyl cloud iPhone (what the crew uses)

This machine has no Xcode, so the build runs on Revyl's macOS runners. In a Capy thread, with the repository checked out at `origin/main`:

```js
// Build: about 6 to 12 minutes. The call returns at once; the thread is woken when it finishes.
const build = await tools.mobile.build({
  action: "start",
  platform: "ios",
  app: "lineup",
  source: {
    type: "workspace",
    path: "ycconsumerhackathon",              // the repository folder under the workspace root
    commands: ["bash scripts/build-ios-sim.sh"],
    output_path: "build/Lineup-sim.zip",
    timeout_seconds: 2700,
  },
});

// Phone: attach once per thread, then install each new build on the same phone.
const phone = await tools.capy.phone({ action: "attach", platform: "ios", model: "iPhone 18 Pro" });
await tools.capy.phone({ action: "install", machine: { machine_id: phone.machine_id }, build_id: build.build_id });

// Drive it and take the screenshot.
const screen = tools.capy.computer.on({ machine_id: phone.machine_id }).screen;
await screen.screenshot();
```

A phone session lasts 60 minutes. After that the phone sleeps, and the next use starts a fresh session with the same build and no app data.

### 2. On every labelled pull request (Revyl proof of changes)

`.revyl/config.yaml` has a `pull-request` profile that runs this script. A pull request with the `revyl-proof` label (or a `@revyl proof ios` comment) is built, installed on a cloud iPhone and exercised by Revyl, which posts a verdict with screenshots on the pull request. With the Revyl CLI signed in, the same profile builds by hand: `revyl build --profile pull-request --platform ios`.

### 3. On a Mac with Xcode

```bash
bash scripts/build-ios-sim.sh
unzip -o build/Lineup-sim.zip -d build/
xcrun simctl boot "iPhone 17 Pro" || true
xcrun simctl install booted build/Lineup.app
xcrun simctl launch booted com.lineup.app
```

## What a cloud simulator can't do

No camera, no microphone input and no real GPS. The app's development options stand in for them (sample photos, a typed transcript, a fixed location), and the owner checks the real hardware on their own iPhone with [docs/demo/REAL_PHONE.md](../docs/demo/REAL_PHONE.md).
