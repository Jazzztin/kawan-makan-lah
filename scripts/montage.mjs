// Compose extracted frames into one contact sheet per character so I can view
// the whole grid at once and pick walk frames. Frames are placed on a gray
// checker-free light background, each cell labeled by position via placement.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { PNG } from "pngjs";

const files = readdirSync("preview/frames").filter(f => f.endsWith(".png"));

for (const key of ["c1", "c2", "c3"]) {
  const mine = files.filter(f => f.startsWith(key + "_"));
  // parse r,c
  const parsed = mine.map(f => {
    const m = f.match(/_r(\d+)_c(\d+)\.png$/);
    return { f, r: +m[1], c: +m[2], png: PNG.sync.read(readFileSync("preview/frames/" + f)) };
  });
  const maxR = Math.max(...parsed.map(p => p.r));
  const maxC = Math.max(...parsed.map(p => p.c));
  const cellW = Math.max(...parsed.map(p => p.png.width)) + 8;
  const cellH = Math.max(...parsed.map(p => p.png.height)) + 8;
  const sc = 2; // upscale so detail is visible
  const W = (maxC + 1) * cellW * sc, H = (maxR + 1) * cellH * sc;
  const sheet = new PNG({ width: W, height: H });
  // light gray bg
  for (let i = 0; i < W * H; i++) { sheet.data[i * 4] = 220; sheet.data[i * 4 + 1] = 220; sheet.data[i * 4 + 2] = 225; sheet.data[i * 4 + 3] = 255; }
  for (const p of parsed) {
    const ox = (p.c * cellW + 4) * sc, oy = (p.r * cellH + 4) * sc;
    for (let y = 0; y < p.png.height; y++) for (let x = 0; x < p.png.width; x++) {
      const si = (y * p.png.width + x) * 4;
      if (p.png.data[si + 3] < 128) continue;
      for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) {
        const X = ox + x * sc + dx, Y = oy + y * sc + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const di = (Y * W + X) * 4;
        sheet.data[di] = p.png.data[si]; sheet.data[di + 1] = p.png.data[si + 1]; sheet.data[di + 2] = p.png.data[si + 2]; sheet.data[di + 3] = 255;
      }
    }
  }
  writeFileSync(`preview/montage_${key}.png`, PNG.sync.write(sheet));
  console.log(`preview/montage_${key}.png  ${W}x${H}  (${maxR + 1} rows x ${maxC + 1} cols)`);
}
