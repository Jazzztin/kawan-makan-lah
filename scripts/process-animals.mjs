// Convert the AI-generated animal JPGs (checkered "transparent" background,
// 2752x1536) into real game sprites: remove the checker background, crop to
// the animal, and downscale to a small sprite. Pure-JS with pngjs + jpeg
// decoding via the browser is overkill, so we decode JPEG with a tiny helper:
// we rely on sharp if available, else fall back to a manual approach.
//
// Strategy to remove the checker: the checkerboard is low-saturation gray.
// Flood-fill from the image edges, clearing any pixel whose saturation is low
// AND whose brightness is in the gray range, until we hit the saturated/dark
// animal. This keeps the black-outlined animal and drops the checker.

import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

// Decode JPEG using the "jpeg-js" package if present; otherwise instruct.
let jpeg;
try {
  jpeg = (await import("jpeg-js")).default ?? (await import("jpeg-js"));
} catch {
  console.error("Missing jpeg-js. Run: npm install -D jpeg-js");
  process.exit(1);
}

const jobs = [
  { in: "../Assets/folder/Malayan_tapir_pixel_art_sprite_1b5e0055_2K.jpg", out: "public/assets/scene/tapir.png", target: 40 },
  { in: "../Assets/folder/Hornbill_bird_pixel_sprite_c151605b_2K.jpg", out: "public/assets/scene/hornbill.png", target: 40 },
  { in: "../Assets/folder/Orangutan_sitting_pixel_art_sprite_4484e279_2K.jpg", out: "public/assets/scene/orangutan.png", target: 40 },
];

function sat(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

for (const job of jobs) {
  const raw = jpeg.decode(readFileSync(job.in), { useTArray: true });
  const { width: W, height: H, data } = raw; // RGBA
  const alpha = new Uint8Array(W * H).fill(1); // 1 = keep, 0 = clear

  // mark checker-ish pixels (low saturation, mid/high brightness) as candidates
  const bg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const s = sat(r, g, b);
    const bright = (r + g + b) / 3;
    // checker squares are grayscale: very low saturation. Animal outline is
    // near-black but also low saturation, so also require brightness > 70 to
    // avoid eating the black outline.
    if (s < 0.12 && bright > 70) bg[i] = 1;
  }

  // flood fill from edges through bg candidates -> transparent
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + (W - 1)); }
  const visited = new Uint8Array(W * H);
  while (stack.length) {
    const idx = stack.pop();
    if (idx < 0 || idx >= W * H || visited[idx]) continue;
    visited[idx] = 1;
    if (!bg[idx]) continue; // stop at the animal
    alpha[idx] = 0;
    const x = idx % W, y = (idx / W) | 0;
    if (x > 0) stack.push(idx - 1);
    if (x < W - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - W);
    if (y < H - 1) stack.push(idx + W);
  }

  // bounding box of kept pixels
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha[y * W + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;

  // downscale by block-averaging to target height, preserving aspect
  const scale = job.target / bh;
  const ow = Math.max(1, Math.round(bw * scale));
  const oh = job.target;
  const out = new PNG({ width: ow, height: oh });
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      const sx0 = minX + Math.floor(ox / scale), sy0 = minY + Math.floor(oy / scale);
      const sx1 = minX + Math.floor((ox + 1) / scale), sy1 = minY + Math.floor((oy + 1) / scale);
      let r = 0, g = 0, b = 0, a = 0, n = 0, kept = 0;
      for (let sy = sy0; sy < Math.max(sy1, sy0 + 1); sy++) {
        for (let sx = sx0; sx < Math.max(sx1, sx0 + 1); sx++) {
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
          const i = sy * W + sx; n++;
          if (alpha[i]) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; kept++; }
        }
      }
      const di = (oy * ow + ox) << 2;
      if (kept > n / 2) {
        out.data[di] = (r / kept) | 0; out.data[di + 1] = (g / kept) | 0; out.data[di + 2] = (b / kept) | 0; out.data[di + 3] = 255;
      } else { out.data[di + 3] = 0; }
    }
  }
  writeFileSync(job.out, PNG.sync.write(out));
  console.log(`${job.out}: ${ow}x${oh} (from ${bw}x${bh})`);
}
