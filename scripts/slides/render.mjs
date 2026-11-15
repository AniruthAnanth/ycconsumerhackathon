#!/usr/bin/env node
// Turns raw iPhone screenshots into 1920x1080 pitch slides. Zero dependencies:
// each slide is a self-contained HTML string rasterised by headless Chrome.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const arg = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};
const inDir = arg("--in");
const outDir = arg("--out");
if (!inDir || !outDir) {
  console.error("usage: node scripts/slides/render.mjs --in <dir of raw PNGs> --out <dir>");
  process.exit(1);
}

const findChrome = () => {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const dir of (process.env.PATH ?? "").split(":")) {
    for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
      const p = join(dir, name);
      if (dir && existsSync(p)) return p;
    }
  }
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      for (const sub of readdirSync(join(cache, d)).filter((s) => s.startsWith("chrome-linux"))) {
        const p = join(cache, d, sub, "chrome");
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined;
};

const chrome = findChrome();
if (!chrome) {
  console.error("No Chrome/Chromium found. Install one (for example: npx -y playwright install chromium) or set CHROME_BIN.");
  process.exit(1);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: #fff; }
body { font-family: -apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif; color: #0b0b0f; position: relative; }
.mark { position: absolute; left: 150px; top: 84px; }
.mark b { display: block; font-size: 22px; font-weight: 800; letter-spacing: 0.22em; color: #0b0b0f; }
.mark i { display: block; width: 44px; height: 5px; border-radius: 3px; background: #12a150; margin-top: 10px; }
.copy { position: absolute; left: 150px; top: 0; bottom: 0; width: 800px; display: flex; flex-direction: column; justify-content: center; }
h1 { font-size: 96px; line-height: 1.03; font-weight: 800; letter-spacing: -0.035em; color: #0b0b0f; }
.rule { width: 96px; height: 4px; border-radius: 2px; background: #0a64f0; margin: 40px 0 34px; }
p.sub { font-size: 36px; line-height: 1.3; font-weight: 400; color: #6b7078; max-width: 680px; letter-spacing: -0.01em; }
.foot { position: absolute; left: 150px; bottom: 70px; font-size: 20px; color: #8b9097; }
.stage { position: absolute; left: 1020px; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; }
.stage::before { content: ""; position: absolute; left: 0; top: 90px; bottom: 90px; width: 1px; background: #e3e5e8; }
.phone { position: relative; height: 940px; background: #0b0b0f; border-radius: 96px; padding: 14px; box-shadow: 0 40px 80px rgba(11,11,15,0.18); }
.phone::before { content: ""; position: absolute; inset: 3px; border-radius: 93px; border: 2px solid #3a3d44; pointer-events: none; z-index: 2; }
.screen { width: 100%; height: 100%; border-radius: 82px; overflow: hidden; background: #fff; position: relative; }
.screen img { display: block; width: 100%; height: 100%; }
.island { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); width: 120px; height: 35px; border-radius: 18px; background: #000; }
.btn { position: absolute; width: 5px; background: #2a2c31; }
.btn.l1 { left: -5px; top: 190px; height: 40px; border-radius: 3px 0 0 3px; }
.btn.l2 { left: -5px; top: 260px; height: 76px; border-radius: 3px 0 0 3px; }
.btn.l3 { left: -5px; top: 356px; height: 76px; border-radius: 3px 0 0 3px; }
.btn.r1 { right: -5px; top: 300px; height: 116px; border-radius: 0 3px 3px 0; }
`;

const page = (headline, sub, visual, foot = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="mark"><b>LINEUP</b><i></i></div>
<div class="copy"><h1>${esc(headline)}</h1><div class="rule"></div><p class="sub">${esc(sub)}</p></div>
${foot ? `<div class="foot">${esc(foot)}</div>` : ""}
<div class="stage">${visual}</div>
</body></html>`;

const phoneHtml = (png) => {
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  const screenW = Math.round((912 * w) / h);
  return `<div class="phone" style="width:${screenW + 28}px">
<span class="btn l1"></span><span class="btn l2"></span><span class="btn l3"></span><span class="btn r1"></span>
<div class="screen"><img alt="" src="data:image/png;base64,${png.toString("base64")}"><span class="island"></span></div></div>`;
};

const watchHtml = `<style>
.watch { position: relative; width: 520px; height: 960px; }
.band { position: absolute; left: 90px; width: 340px; background: #d7d9dd; }
.band.top { top: 0; height: 200px; border-radius: 60px 60px 0 0; }
.band.bot { bottom: 0; height: 200px; border-radius: 0 0 60px 60px; }
.case { position: absolute; left: 0; top: 175px; width: 520px; height: 610px; border-radius: 150px; background: #1b1c20; padding: 18px; box-shadow: 0 40px 80px rgba(11,11,15,0.18); }
.case::before { content: ""; position: absolute; inset: 2px; border-radius: 148px; border: 2px solid #3a3d44; }
.crown { position: absolute; right: -22px; top: 150px; width: 26px; height: 110px; border-radius: 0 14px 14px 0; background: #2b2d33; }
.crown::after { content: ""; position: absolute; left: 8px; top: 12px; bottom: 12px; width: 2px; background: #4a4d55; }
.side { position: absolute; right: -10px; top: 330px; width: 12px; height: 70px; border-radius: 0 8px 8px 0; background: #2b2d33; }
.wscreen { width: 100%; height: 100%; border-radius: 132px; background: #000; padding: 44px 30px 0; position: relative; overflow: hidden; color: #fff; }
.time { position: absolute; top: 44px; left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 600; color: #fff; }
.card { margin-top: 64px; background: #26272b; border-radius: 40px; padding: 28px 30px 32px; }
.app { display: flex; align-items: center; gap: 12px; font-size: 18px; font-weight: 600; letter-spacing: 0.08em; color: #a5a8ae; }
.ico { width: 34px; height: 34px; border-radius: 10px; background: #34c759; position: relative; }
.ico::before { content: ""; position: absolute; left: 7px; top: 8px; width: 20px; height: 15px; border-radius: 8px; background: #fff; }
.ico::after { content: ""; position: absolute; left: 9px; top: 19px; width: 7px; height: 7px; background: #fff; transform: skewX(-30deg); }
.from { margin-top: 18px; font-size: 32px; font-weight: 700; color: #fff; }
.nb { white-space: nowrap; }
.body { margin-top: 10px; font-size: 27px; line-height: 1.3; font-weight: 400; color: #e8e9ec; }
.body b { font-weight: 700; color: #fff; }
.btns { display: flex; gap: 14px; margin-top: 18px; }
.btns span { flex: 1; text-align: center; padding: 18px 0; border-radius: 30px; background: #26272b; font-size: 24px; font-weight: 600; color: #fff; }
.btns span.pri { background: #0a64f0; }
.band.bot::before { content: ""; position: absolute; left: 50%; top: 60px; width: 14px; height: 14px; margin-left: -7px; border-radius: 7px; background: #b3b6bc; box-shadow: 0 36px 0 #b3b6bc, 0 72px 0 #b3b6bc; }
.band.top::before { content: ""; position: absolute; left: 24px; right: 24px; bottom: 28px; height: 2px; background: #c3c6cb; box-shadow: 0 -22px 0 #c3c6cb; }
.dots { position: absolute; left: 0; right: 0; bottom: 34px; display: flex; justify-content: center; gap: 10px; }
.dots span { width: 10px; height: 10px; border-radius: 5px; background: #4a4d55; }
.dots span:first-child { background: #fff; }
</style><div class="watch">
<div class="band top"></div><div class="band bot"></div>
<div class="case"><span class="crown"></span><span class="side"></span>
<div class="wscreen"><span class="time">9:41</span>
<div class="card"><div class="app"><span class="ico"></span>MESSAGES</div>
<div class="from">Lineup</div>
<div class="body"><b>Quick-time:</b> 20 <span class="nb">push-ups</span> in the next 2 hours, three fingers up in the photo. +40. Reply with a photo.</div></div>
<div class="btns"><span>Dismiss</span><span class="pri">Reply</span></div>
<div class="dots"><span></span><span></span></div></div></div></div>`;

const raster = (html, outPng) => {
  const tmp = mkdtempSync(join(tmpdir(), "lineup-slide-"));
  const file = join(tmp, "slide.html");
  writeFileSync(file, html);
  try {
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1920,1080",
        "--disable-gpu",
        `--user-data-dir=${join(tmp, "profile")}`,
        `--screenshot=${outPng}`,
        `file://${file}`,
      ],
      { stdio: "pipe", timeout: 60000 },
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (!existsSync(outPng)) throw new Error(`Chrome produced no file for ${outPng}`);
};

const slides = JSON.parse(readFileSync(join(here, "slides.json"), "utf8"));
mkdirSync(resolve(outDir), { recursive: true });

let made = 0;
for (const s of slides) {
  const src = join(resolve(inDir), s.file);
  if (!existsSync(src)) {
    console.warn(`warning: ${s.file} not found in ${inDir}, skipping ${s.name}`);
    continue;
  }
  const out = join(resolve(outDir), `${s.name}-framed.png`);
  raster(page(s.headline, s.sub, phoneHtml(readFileSync(src))), out);
  console.log(`wrote ${out}`);
  made++;
}

const watchOut = join(resolve(outDir), "watch-concept.png");
raster(
  page(
    "Drops reach your wrist by text",
    "This is a concept image; Lineup has no watch app and sends iMessage texts through Keiki.",
    watchHtml,
    "Concept. Rendered from HTML, not captured from a watch.",
  ),
  watchOut,
);
console.log(`wrote ${watchOut}`);
console.log(`done: ${made} framed slides + watch concept`);
