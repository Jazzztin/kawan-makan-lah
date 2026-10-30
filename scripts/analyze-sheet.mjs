// Analyze a magenta-background sprite sheet: find which columns and rows are
// "empty" (pure magenta) vs. contain sprite content, so we can detect the
// frame grid automatically instead of guessing.

import { readFileSync } from "node:fs";

const jpeg = (await import("jpeg-js")).default ?? (await import("jpeg-js"));

const file = process.argv[2];
const raw = jpeg.decode(readFileSync(file), { useTArray: true });
const { width: W, height: H, data } = raw;

function isMagenta(r, g, b) {
  // bright pink/magenta: high R, low G, high B
  return r > 180 && g < 120 && b > 180;
}

// fraction of non-magenta pixels per column and per row
const colFill = new Float32Array(W);
const rowFill = new Float32Array(H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const content = !isMagenta(data[i], data[i + 1], data[i + 2]);
    if (content) { colFill[x] += 1; rowFill[y] += 1; }
  }
}
for (let x = 0; x < W; x++) colFill[x] /= H;
for (let y = 0; y < H; y++) rowFill[y] /= W;

// collapse into runs of content vs. empty using a threshold
function runs(arr, thresh) {
  const out = [];
  let start = -1;
  for (let i = 0; i < arr.length; i++) {
    const on = arr[i] > thresh;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { out.push([start, i - 1]); start = -1; }
  }
  if (start >= 0) out.push([start, arr.length - 1]);
  return out;
}

const colRuns = runs(colFill, 0.01);
const rowRuns = runs(rowFill, 0.01);
console.log(`${file}  ${W}x${H}`);
console.log(`content column bands (${colRuns.length}):`, colRuns.map(r => `${r[0]}-${r[1]}`).join("  "));
console.log(`content row bands (${rowRuns.length}):`, rowRuns.map(r => `${r[0]}-${r[1]}`).join("  "));
