# Lineup on your own iPhone (Expo Go)

A cloud simulator has no camera, no microphone and no real GPS, so these three can only be confirmed on a real phone. This takes about five minutes. Nothing here needs an Apple developer account, a cable or Xcode.

**Custom build needed? No.** Every native library in `package.json` ships inside Expo Go (checked by `node scripts/check-expo-go.mjs`, which fails if that ever changes). The project is on Expo SDK 58, which is the SDK the App Store's Expo Go runs today.

## 1. On the iPhone

1. Install **Expo Go** from the App Store, or update it if it's already installed. It must be version 58 or later: each Expo Go runs exactly one SDK, and an older copy shows "Project is incompatible with this version of Expo Go".

## 2. On your Mac

```bash
cd ~/Documents/philosophy/ycconsumerhackathon
git fetch origin && git checkout main && git pull origin main
npm ci
npx expo start --tunnel ngrok
```

- The first run asks to install `@expo/ngrok`: answer **y**.
- Use `--tunnel ngrok` exactly. Plain `--tunnel` asks for an Expo account login; the ngrok form needs no account.
- The tunnel is the safe choice at the venue, because event Wi-Fi usually blocks phones from reaching laptops. If you'd rather skip it, join the Mac to the iPhone's Personal Hotspot and run `npx expo start` instead: it's faster and works without a tunnel.
- No environment setup is needed. The Convex URL is committed in `.env`, and the app holds no secrets.
- A QR code appears in the terminal once it prints "Tunnel ready".

## 3. Open the app

1. Point the iPhone's **Camera** at the QR code and tap the "Open in Expo Go" banner.
2. The first load takes 20 to 40 seconds over the tunnel while the JavaScript bundles. Later loads are quick.
3. To get new code after the crew merges: `git pull origin main` on the Mac (and `npm ci` if `package.json` changed), then shake the phone and tap **Reload**.

## 4. What to test for real

Allow each permission the first time iOS asks. The prompts name Expo Go, not Lineup; that's expected in Expo Go.

| # | Test | Steps | Pass looks like |
| --- | --- | --- | --- |
| 1 | **Microphone** | Roster, **Voice Draft**, hold the record button and say a real week ("gym three times, finish my problem set, call mom, laundry, read 30 minutes"). | A transcript of what you said, then five to eight tasks, one per slot. Lock Lineup works. |
| 2 | **Camera** | Tap a task on Roster, **Submit Proof**. Take a real photo of the real thing. | Live camera with the task title overlaid, then a VERIFIED stamp with a reason that describes your photo, and the points on Roster. |
| 3 | **Camera, wrong photo** | Submit a photo of something unrelated for another task. | NOT VERIFIED with a readable reason. The task stays open and can be retried. |
| 4 | **Location** | Open a task marked "Photo + location" and submit a proof while physically at that place (the seeded one is the YC office). | Passes only when you are within 150 m of the pin; the reason says so. Away from the place it fails and says how far off you were. |
| 5 | **Contacts** | League tab, **Allow access to contacts**. | iOS asks once. Contacts already on Lineup join the league; the rest are offered an invite text. |
| 6 | **Pay** | Tap the Pay banner. Card 4242 4242 4242 4242, any future date, any CVC. | The Whop sandbox checkout opens in a browser sheet. After paying, the banner disappears and the pot on League rises without reopening the app. |
| 7 | **Texts** | Demo controls, trigger a quick-time drop, with your real number on your player. | A text from the Keiki number arrives. Replying with a photo returns a verdict, and a new Feed item appears. |

Tests 1, 2 and 4 are the ones only you can do. Please report each as pass or fail, with a screenshot of any failure, on issue ANI-52.

## If something goes wrong

- **"Project is incompatible with this version of Expo Go"**: update Expo Go from the App Store.
- **The QR code opens but loading never finishes**: stop the server with Ctrl+C and start it again; ngrok tunnels sometimes drop. Or switch to the hotspot method above.
- **A permission was denied by mistake**: iPhone Settings, Expo Go, turn on Camera, Microphone, Location or Contacts, then reload.
- **A red error screen**: screenshot it and post it on ANI-52. Shake and Reload usually clears a stale bundle.
- **Location says you're far away when you aren't**: Settings, Privacy & Security, Location Services, Expo Go, turn on **Precise Location**.

## What Expo Go can't show

- The home-screen icon and splash screen are Expo Go's, not Lineup's. The cloud-phone builds show the real ones.
- The on-device pre-check (Apple Vision) is a native module that exists only in a standalone iOS build. In Expo Go it is absent by design and the server referee judges every proof on its own, so verdicts still work.
- A prompt that fires while the app is closed. Expo Go doesn't run background tasks on iOS, so check-in prompts appear when the app is open or brought back to the foreground.

## Keep the stand-ins off

Sample photos, the typed transcript and the fixed location exist for cloud phones. They are off unless a build sets `EXPO_PUBLIC_DEV_FLAGS=1`, which Expo Go does not, and Demo controls can switch them on at runtime. Leave them off on the real phone so these tests use the real camera, microphone and GPS.
