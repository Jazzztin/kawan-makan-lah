// Process the kopitiam stall backdrop (checker bg) and the logo (white bg)
// into clean transparent PNGs for the scene backdrop and title banner.

import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jpegMod from "jpeg-js";
const jpeg = jpegMod.default ?? jpegMod;

function sat(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

// Remove an edge-connected background, crop to content, downscale to target height.
function convert({ infile, outfile, target, isBgPixel }) {
  const raw = jpeg.decode(readFileSync(infile), { useTArray: true });
  const W = raw.width, H = raw.height, data = raw.data;
  const bg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (isBgPixel(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) bg[i] = 1;
  }
  const alpha = new Uint8Array(W * H).fill(1);
  const vis = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) { st.push(x); st.push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { st.push(y * W); st.push(y * W + W - 1); }
  while (st.length) {
    const idx = st.pop();
    if (idx < 0 || idx >= W * H || vis[idx]) continue;
    vis[idx] = 1;
    if (!bg[idx]) continue;
    alpha[idx] = 0;
    const x = idx % W, y = (idx / W) | 0;
    if (x > 0) st.push(idx - 1);
    if (x < W - 1) st.push(idx + 1);
    if (y > 0) st.push(idx - W);
    if (y < H - 1) st.push(idx + W);
  }
  let mnX = W, mnY = H, mxX = 0, mxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x]) {
    if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y;
  }
  const bw = mxX - mnX + 1, bh = mxY - mnY + 1, scale = target / bh;
  const ow = Math.round(bw * scale), oh = target;
  const out = new PNG({ width: ow, height: oh });
  for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
    const sx0 = mnX + Math.floor(ox / scale), sy0 = mnY + Math.floor(oy / scale);
    const sx1 = mnX + Math.floor((ox + 1) / scale), sy1 = mnY + Math.floor((oy + 1) / scale);
    let r = 0, g = 0, b = 0, n = 0, k = 0;
    for (let sy = sy0; sy < Math.max(sy1, sy0 + 1); sy++) for (let sx = sx0; sx < Math.max(sx1, sx0 + 1); sx++) {
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      n++; const i = sy * W + sx;
      if (alpha[i]) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; k++; }
    }
    const di = (oy * ow + ox) << 2;
    if (k > n / 2) { out.data[di] = r / k | 0; out.data[di + 1] = g / k | 0; out.data[di + 2] = b / k | 0; out.data[di + 3] = 255; }
    else out.data[di + 3] = 0;
  }
  writeFileSync(outfile, PNG.sync.write(out));
  console.log(`${outfile}: ${ow}x${oh} (from ${bw}x${bh})`);
}

// Stall: gray checker background (low saturation, mid/high brightness).
convert({
  infile: "../Assets/folder/Malaysian_food_stall_counter_ec323d63_2K.jpg",
  outfile: "public/assets/scene/stall.png",
  target: 150,
  isBgPixel: (r, g, b) => sat(r, g, b) < 0.12 && (r + g + b) / 3 > 70,
});

// Logo: near-white background.
convert({
  infile: "../Assets/folder/Malaysian_food_store_logo_c32eece2_2K.jpg",
  outfile: "public/assets/scene/logo.png",
  target: 120,
  isBgPixel: (r, g, b) => r > 232 && g > 232 && b > 232,
});
