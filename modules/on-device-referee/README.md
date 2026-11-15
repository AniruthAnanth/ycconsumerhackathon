# On-device referee

An instant read of a proof photo by Apple's Vision framework, shown on the verdict screen while the photo is on its way to the server referee: "On-device: barbell, gym. Sending to the referee...". When the photo plainly shows something else, the player is offered Retake before a server verification is spent.

It is a courtesy, not a judge. Only `proofs.verify` on the server awards points.

## Pieces

| File | What it does |
| --- | --- |
| `ios/OnDeviceRefereeModule.swift` | The local Expo module. `VNClassifyImageRequest` for labels, `VNDetectHumanRectanglesRequest` for people, `VNDetectHumanHandPoseRequest` for a drop's finger-count gesture. No bundled model, no network. |
| `index.ts` | The optional JavaScript binding. `null` wherever the native half doesn't exist. |
| `lib/onDeviceReferee.ts` | `isAvailable()` and `precheck(photoUri, task)`. Never throws, gives up after two seconds. |
| `lib/onDeviceRefereeRules.ts` | Pure and tested: which Vision labels a task's slot and title words suggest, and when a photo counts as a plain mismatch. |
| `components/onDeviceReferee/` | The hook and the line the verdict screen mounts. |

Expo's autolinking finds the module because it lives under `modules/` and has an `expo-module.config.json`. Nothing in `package.json` or `app.json` refers to it.

## Where it runs

| Build | Result |
| --- | --- |
| Standalone iOS build on an iPhone | On. |
| Expo Go | Absent. Expo Go can't load a local native module, so `isAvailable()` is false and the verdict screen is unchanged. |
| iOS simulator, including Revyl's cloud phones | Off. The module is linked and reports `isSupported() === false`. |
| Android, web | Absent. |

### Why the simulator is off

Measured on Revyl's iOS 27 simulators on 15 November 2026. Vision's classifier ran without an error but returned the same answer for every photo (`outdoor 0.49, night_sky 0.49, sky 0.49`), and hand-pose detection found no hands in a crowd of raised hands. CoreVideo logged `CVPixelBufferCreate returned err -6680` on each call: the models are handed a blank image. The result was identical for a file URL, a `CGImage`, a `CIImage`, raw `Data` and a BGRA pixel buffer, with the default compute device, CPU-only, and the Swift `ClassifyImageRequest` API. People detection did work there. A confident wrong hint is worse than none, so the simulator never calls Vision.

## Not yet measured on a real iPhone

The module has compiled, linked and loaded in the Revyl build (`scripts/build-ios-sim.sh`), and the rules are unit-tested, but no build made so far could run Vision on real hardware. Two things follow:

- The label mapping in `lib/onDeviceRefereeRules.ts` is written from Vision's published label list, not from photos classified on a phone. It leans towards "looks fine" for that reason.
- Finger counting is only named in the hint ("3 fingers up", "no hand seen") and never offers Retake. To let a missing hand offer Retake once it has been checked on a phone, return `likelyMatch: false` for that case in `judgePhoto`.

## See it on your own iPhone

This needs a Mac with Xcode and an Apple ID, because it installs a standalone build instead of opening Expo Go:

```bash
npm ci
npx expo run:ios --device --configuration Release
```

Pick the plugged-in iPhone when asked. The first run asks for a signing team in Xcode; a free Apple ID works for seven days.
