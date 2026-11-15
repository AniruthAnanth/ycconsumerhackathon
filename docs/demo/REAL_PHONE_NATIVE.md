# Lineup on your own iPhone as a native build (Xcode)

Expo Go ([REAL_PHONE.md](REAL_PHONE.md)) can't load native code, so four things exist only in a build made with Xcode: the Live Activity with the Dynamic Island and the home-screen widget, notifications from the app itself, the on-device pre-check, and Lineup's own icon and splash screen. This page puts a **Release** build on a plugged-in iPhone from a Mac. Release embeds the JavaScript in the app, so once it is installed it runs with no Mac, no cable and no Metro server.

Expo Go stays the fallback. Nothing here changes what it runs, and `node scripts/check-expo-go.mjs` still has to pass.

**What has been run.** Every command on this page was run on the owner's MacBook Pro on November 15 with Xcode 27.2 and a free personal team, against main at 439ab4b: the signed Release build installed on an iPhone 17 Pro Max on iOS 27.2 and launched at 1:43 PM, with the app and its `LineupWidgets` extension both running. The quotas under "Signing with a free Apple ID" are Apple's published limits and were not reached here.

## Once per Mac and phone

1. **Xcode, signed in.** Open Xcode, then **Xcode → Settings… → Accounts → + → Apple Account**. A free Apple ID is enough; it appears as a "Personal Team".
2. **CocoaPods and Node 22 or newer.** `brew install cocoapods`. Homebrew puts `pod` in its gem folder, which a script's shell may not have on its PATH: `export PATH="$(brew --prefix)/lib/ruby/gems/4.0.0/bin:$PATH"`.
3. **The iPhone.** Plug it in with a cable, unlock it, and tap **Trust** if it asks "Trust This Computer?". Developer Mode must be on: Settings → Privacy & Security → Developer Mode (the phone restarts once).
4. **Two identifiers.**
   ```bash
   xcrun devicectl list devices      # the phone's Identifier; "unavailable" means it is known but not plugged in and unlocked
   defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier | grep -E 'teamID|teamName'   # your 10-character team id
   ```
   Right after you sign in the second command prints nothing: Xcode only records the team once you have opened it. In Xcode → Settings… → Accounts, click your account, then **Manage Certificates… → + → Apple Development → Done**, and run the command again. (Xcode 26 and earlier call the key `IDEProvisioningTeams`.)

## Build and install

Build in a checkout that is **not** the one Expo Go runs from, because `expo prebuild` generates an `ios/` folder and rewrites two scripts in `package.json`:

```bash
cd ~/Documents/philosophy/ycconsumerhackathon
git fetch origin && git worktree add --detach ../lineup-native origin/main
cd ../lineup-native
```

Then, in that folder:

```bash
export LINEUP_APPLE_TEAM_ID=XXXXXXXXXX                 # your team id
export LINEUP_IOS_BUNDLE_ID=com.yourname.lineup        # an identifier no other team has registered
export LINEUP_PERSONAL_TEAM=1                          # free Apple ID only; leave unset on a paid team
PHONE=00000000-0000000000000000                        # the phone's Identifier
BUILD="$HOME/Library/Developer/Xcode/DerivedData/Lineup-device"

git fetch origin && git checkout --detach origin/main
npm ci
npm run typecheck                                      # never install a main that doesn't typecheck
CI=1 npx expo prebuild --platform ios --clean          # generates ios/ and runs pod install
git restore package.json                               # prebuild rewrote the "ios" and "android" scripts
# The bundling build phase reads this file; it is how the Convex URL reaches the JavaScript bundle.
echo 'export EXPO_PUBLIC_CONVEX_URL=https://sensible-guineapig-9.convex.cloud' >> ios/.xcode.env.local

xcodebuild -workspace ios/Lineup.xcworkspace -scheme Lineup -configuration Release \
  -destination "id=$PHONE" -derivedDataPath "$BUILD" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration

xcrun devicectl device install app --device "$PHONE" "$BUILD/Build/Products/Release-iphoneos/Lineup.app"
xcrun devicectl device process launch --device "$PHONE" "$LINEUP_IOS_BUNDLE_ID"
```

The whole cycle, from `git fetch` to the app on the phone, took 4 min 53 s on the owner's MacBook Pro. Leave `EXPO_PUBLIC_DEV_FLAGS` unset: it turns on the sample photos, typed transcript and fixed location that cloud phones need, and a real phone should use its real camera, microphone and GPS.

The three `LINEUP_*` variables are read by `app.config.js`. With none of them set it returns `app.json` untouched, which is why Expo Go and the Revyl builds are unaffected by anything on this page.

## First launch on the phone

1. The install succeeds but the first launch is refused with "…its profile has not been explicitly trusted by the user". On the phone: Settings → General → VPN & Device Management → **Developer App** → your Apple ID → **Trust**. Then open Lineup from the home screen, or run the launch command again.
2. macOS may ask for your Mac login password the first time the build signs ("codesign wants to access key…"). Enter it and choose **Always Allow**, or every later build stops to ask again.
3. Unplug the phone. The app keeps working: the JavaScript is inside it.
4. The first time a Live Activity appears on the lock screen, iOS asks "Allow Live Activities from Lineup?". Tap **Allow**. The activity is started from Roster while a quick-time drop is live in your league.

## Rebuilding after main moves

Run the build block again from `git fetch`. Installing over the old build keeps the app's data, so you stay signed in as the same player.

## Signing with a free Apple ID

These are Apple's limits for a personal team, and what the switches do about them.

- **No Push Notifications.** A personal team can't sign the `aps-environment` entitlement that `expo-notifications` adds, and one unsignable entitlement fails the whole build. `LINEUP_PERSONAL_TEAM=1` removes it. Local notifications and Live Activities started by the app don't need it; only pushes sent from a server do.
- **The bundle identifier must be yours.** Only one team can register `com.lineup.app`. `LINEUP_IOS_BUNDLE_ID` changes the app's identifier, and the widget extension (`.widgets`) and the App Group (`group.<bundle id>`) follow it.
- **The App Group.** The app and the widget share `group.<bundle id>`. A personal team can sign it: automatic signing registered the group and both targets carry it.
- **Seven days.** A personal team's provisioning profile expires after seven days and the app stops opening. Rebuild and reinstall to renew it.
- **Small quotas.** A personal team gets a limited number of new app identifiers per week (this build uses two) and a few installed apps per phone.

## Traps hit on the owner's Mac

- **`expo prebuild` edits `package.json`.** It changes the `ios` and `android` scripts to `expo run:*`. Restore the file and never commit that change or the `ios/` folder (`/ios` is git-ignored).
- **`pod` not found.** CocoaPods was installed by Homebrew but missing from the PATH of a non-login shell. See step 2 above.
- **`npm ci` says the lock file is out of sync, but CI is green.** The Mac has Node 22 with npm 10 and CI has Node 24 with npm 11, and the two disagree about optional peer dependencies. It happened once, with `@bacons/apple-targets` (fixed before it merged). Check a lock file change with `npx npm@10 ci --dry-run`.
- **A typecheck that fails only on a Mac.** The Mac's disk ignores case, so two files whose names differ only by case (`TaskSheet.tsx` and `taskSheet.ts`) made `tsc` fail there while Linux CI passed. Fixed on main; don't add such pairs.
- **Updating Xcode mid-session.** The App Store replaced Xcode 26.6 with 27.2 during the build session (the phone was already on iOS 27.2). Nothing can build while it installs, the Mac crawls, and the build cache is thrown away afterwards. Don't update Xcode on demo day.
- **Two Xcode builds at once.** Running two builds side by side pushed the Mac's load past 250 and a simulator took ten minutes to boot. Run one at a time.
- **The widget's team.** `@bacons/apple-targets` warns "missing required ios.appleTeamId" when `LINEUP_APPLE_TEAM_ID` is unset. Harmless for an unsigned compile; a signed build needs the variable.
