# Demo assets

The pictures that make the seeded league look lived in: six player avatars, the proof photos behind the feed, the wrapped and the standings, two quick-time gesture photos, one group-session photo, one photo that proves nothing, and the samples the proof camera offers on a simulator. They live in `assets/demo/` and `assets/demo/manifest.json` lists every one with the task it proves and the reason a referee would give.

Every image is generated (Capy's image tool, Gemini 3.1 Flash Image). None is a photograph of a real person or place.

## Who reads the files

| Reader | What it takes |
| --- | --- |
| `convex/seed.ts` | The entries marked `seeded`, through `convex/lib/seedPhotos.ts`, which `embed-seed-photos.mjs` writes. Reset Seed stores them in Convex file storage and attaches them to the seeded proofs and players. |
| `components/capture/samples` | The five files in `assets/demo/samples/` and three of the spares (a call with mom, a gesture photo, the group photo), bundled into the app for the sample-media development flag. |
| Slides and the recording | Anything in the manifest. The entries that are not seeded (a call with mom, meal prep, a second gesture photo, the group photo) are spares for a live demo: text one to the league number or pick it as a proof. |

## Scripts

| Script | What it does |
| --- | --- |
| `encode.sh` | Encodes a source image as a demo file: a JPEG of at most 1200 px with no metadata, or a 256 px square for an avatar. |
| `build-manifest.mjs` | Measures every listed file and writes width, height, bytes and sha256 into the manifest. `--check` fails when the manifest is out of date. It also refuses a file that is missing, unlisted or oversized. |
| `embed-seed-photos.mjs` | Writes `convex/lib/seedPhotos.ts` from the seeded entries. |

## Replacing or adding a picture

```bash
scripts/demo-assets/encode.sh ~/new-gym.png assets/demo/proofs/gym.jpg   # add "avatar" for an avatar
# For a new file, add its entry to assets/demo/manifest.json: file, kind, key, slot, taskTitle, pass, reason, caption.
node scripts/demo-assets/build-manifest.mjs
node scripts/demo-assets/embed-seed-photos.mjs    # only when the file is seeded
npx convex dev --once && npx convex run seed:reset
```

A seeded photo is found in file storage by its SHA-256, so a replaced file is simply uploaded as a new one on the next reset. The old one stays in storage, unused.

## What makes a picture believable

The prompts all asked for the same thing: a casual phone photo a 21-year-old took for their friends, slightly off-centre, in ordinary light, with clutter in the frame, no brand logos and no readable real names. Photos are landscape because the feed shows them in a 4:3 box. Check three things before accepting one: hands have five fingers (and a gesture photo shows exactly the fingers the drop asks for), the number of people is right, and the subject would convince a strict referee without the caption.
