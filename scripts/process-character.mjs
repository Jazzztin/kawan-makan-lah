// Convert the AI-generated chibi character JPGs (checkerboard "transparent"
// background, 2752x1536) into game sprites for the courier, plus cropped head
// portraits for the dialogue box. Three characters are produced; the scene
// picks one at random per customer/order.
//
// Same background-keying strategy as process-animals.mjs: flood-fill the
// low-saturation gray checker from the edges, keep the character, crop to the
// bounding box, then block-average downscale.

import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

let jpeg;
try {
  jpeg = (await import("jpeg-js")).default ?? (await import("jpeg-js"));
} catch {
  console.error("Missing jpeg-js. Run: npm install -D jpeg-js");
  process.exit(1);
}

// All three user-generated chibi characters.
//   char_0 = red cheongsam-style top
//   char_1 = blue/gold batik baju
//   char_2 = blue baju melayu + songkok + samping
const JOBS = [
  { src: "preview/char_0.jpg", body: "courier-1.png", face: "courier-1-face.png" },
  { src: "preview/char_1.jpg", body: "courier-2.png", face: "courier-2-face.png" },
  { src: "preview/char_2.jpg", body: "courier-3.png", face: "courier-3-face.png" },
];

function sat(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

for (const job of JOBS) {
  const raw = jpeg.decode(readFileSync(job.src), { useTArray: true });
  const { width: W, height: H, data } = raw; // RGBA
  const alpha = new Uint8Array(W * H).fill(1);

  const bg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const s = sat(r, g, b);
    const bright = (r + g + b) / 3;
    if (s < 0.12 && bright > 70) bg[i] = 1;
  }

  // flood fill from edges
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + (W - 1)); }
  const visited = new Uint8Array(W * H);
  while (stack.length) {
    const idx = stack.pop();
    if (idx < 0 || idx >= W * H || visited[idx]) continue;
    visited[idx] = 1;
    if (!bg[idx]) continue;
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
  console.log(`${job.src} bbox: ${bw}x${bh} at (${minX},${minY})`);

  function downscaleRegion(rx, ry, rw, rh, targetH) {
    const scale = targetH / rh;
    const ow = Math.max(1, Math.round(rw * scale));
    const oh = targetH;
    const out = new PNG({ width: ow, height: oh });
    for (let oy = 0; oy < oh; oy++) {
      for (let ox = 0; ox < ow; ox++) {
        const sx0 = rx + Math.floor(ox / scale), sy0 = ry + Math.floor(oy / scale);
        const sx1 = rx + Math.floor((ox + 1) / scale), sy1 = ry + Math.floor((oy + 1) / scale);
        let r = 0, g = 0, b = 0, kept = 0, n = 0;
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
    return { out, ow, oh };
  }

  // Full body sprite, ~56px tall.
  {
    const { out, ow, oh } = downscaleRegion(minX, minY, bw, bh, 56);
    writeFileSync(`public/assets/scene/${job.body}`, PNG.sync.write(out));
    console.log(`public/assets/scene/${job.body}: ${ow}x${oh}`);
  }

  // Head portrait: top ~46% of the bbox (head + shoulders), downscaled to 64px.
  {
    const headH = Math.round(bh * 0.46);
    const { out, ow, oh } = downscaleRegion(minX, minY, bw, headH, 64);
    writeFileSync(`public/assets/scene/${job.face}`, PNG.sync.write(out));
    console.log(`public/assets/scene/${job.face}: ${ow}x${oh}`);
  }
}
