# Pitch slides

Turns raw iPhone screenshots into 1920x1080 pitch slides (headline, sub-line, CSS iPhone frame) plus one Apple Watch concept slide.

    node scripts/slides/render.mjs --in <dir of raw PNGs> --out <dir>

Expected raw files in `--in`: roster, voice-draft, verdict, league, feed, wrapped (all `.png`, portrait, any size, never cropped or stretched). Missing ones are skipped with a warning. Output: `<name>-framed.png` for each plus `watch-concept.png` (always written).
It needs headless Chrome or Chromium: it uses CHROME_BIN, then google-chrome / chromium / chromium-browser on PATH, then Playwright's cache. If none exists, run `npx -y playwright install chromium` (not a project dependency).
The words come from [docs/demo/SLIDES.md](../../docs/demo/SLIDES.md), where each line is checked against the code; change them there first. To change a headline or sub-line, edit `scripts/slides/slides.json` (`headline`, `sub` per slide; keep headlines under 40 characters) and re-run. The watch slide text lives at the bottom of `render.mjs`.
