// Slice each magenta sprite sheet into individual frames using the detected
// content bands, key out the magenta background, trim to the sprite bbox, and
// write each frame as its own PNG so we can inspect and choose walk frames.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";

const jpeg = (await import("jpeg-js")).default ?? (await import("jpeg-js"));

const SHEETS = {
  c1: { file: "../Assets/folder/Man_walking_pixel_art_sprite_5121d64b_2K.jpg", cols: 6, rows: 3 },
  c2: { file: "../Assets/folder/Man_walking_sprite_sheet_73142628_2K.jpg", cols: 6, rows: 4 },
  c3: { file: "../Assets/folder/Man_wearing_Baju_Melayu_walking_56af88e0_2K.jpg", cols: 7, rows: 4 },
};

function isMagenta(r, g, b) {
  // bright magenta plus the softer pink halo around sprite edges
  return r > g + 25 && b > g + 25;
}

function bands(arr, thresh) {
  const out = []; let start = -1;
  for (let i = 0; i < arr.length; i++) {
    const on = arr[i] > thresh;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { out.push([start, i - 1]); start = -1; }
  }
  if (start >= 0) out.push([start, arr.length - 1]);
  return out;
}

mkdirSync("preview/frames", { recursive: true });

for (const [key, s] of Object.entries(SHEETS)) {
  const raw = jpeg.decode(readFileSync(s.file), { useTArray: true });
  const { width: W, height: H, data } = raw;

  const colFill = new Float32Array(W), rowFill = new Float32Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!isMagenta(data[i], data[i + 1], data[i + 2])) { colFill[x]++; rowFill[y]++; }
  }
  for (let x = 0; x < W; x++) colFill[x] /= H;
  for (let y = 0; y < H; y++) rowFill[y] /= W;
  const colB = bands(colFill, 0.01), rowB = bands(rowFill, 0.01);

  console.log(`${key}: ${colB.length} cols x ${rowB.length} rows`);

  let r = 0;
  for (const [ry0, ry1] of rowB) {
    let c = 0;
    for (const [rx0, rx1] of colB) {
      // within this cell, build alpha by keying magenta, then bbox-trim
      const cw = rx1 - rx0 + 1, ch = ry1 - ry0 + 1;
      const alpha = new Uint8Array(cw * ch);
      let minX = cw, minY = ch, maxX = 0, maxY = 0, kept = 0;
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
        const i = ((ry0 + yy) * W + (rx0 + xx)) * 4;
        if (!isMagenta(data[i], data[i + 1], data[i + 2])) {
          alpha[yy * cw + xx] = 1; kept++;
          if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
          if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
        }
      }
      if (kept < 50) { c++; continue; }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const out = new PNG({ width: bw, height: bh });
      for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
        const sx = rx0 + minX + xx, sy = ry0 + minY + yy;
        const si = (sy * W + sx) * 4, di = (yy * bw + xx) * 4;
        if (alpha[(minY + yy) * cw + (minX + xx)]) {
          out.data[di] = data[si]; out.data[di + 1] = data[si + 1]; out.data[di + 2] = data[si + 2]; out.data[di + 3] = 255;
        } else out.data[di + 3] = 0;
      }
      writeFileSync(`preview/frames/${key}_r${r}_c${c}.png`, PNG.sync.write(out));
      c++;
    }
    r++;
  }
}
console.log("done");
