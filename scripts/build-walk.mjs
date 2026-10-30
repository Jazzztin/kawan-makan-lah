// Run extract-frames.mjs first. Build four-frame front and side rows from the
// user's walking JPGs, plus matching portraits. Left-facing uses a CSS flip.
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const PLANS = {
  "courier-1": [
    ["c1_r0_c0", "c1_r0_c1", "c1_r0_c2", "c1_r0_c1"],
    ["c1_r1_c3", "c1_r1_c4", "c1_r1_c5", "c1_r1_c4"],
  ],
  "courier-2": [
    ["c2_r1_c0", "c2_r1_c1", "c2_r1_c2", "c2_r1_c1"],
    ["c2_r3_c3", "c2_r3_c4", "c2_r3_c5", "c2_r3_c4"],
  ],
  "courier-3": [
    ["c3_r0_c0", "c3_r0_c1", "c3_r0_c2", "c3_r0_c3"],
    ["c3_r3_c0", "c3_r3_c1", "c3_r3_c2", "c3_r3_c1"],
  ],
};
const CELL = 64;

for (const [name, rows] of Object.entries(PLANS)) {
  const sheet = new PNG({ width: CELL * 4, height: CELL * 2 });
  rows.forEach((names, row) => names.forEach((file, column) => {
    const src = PNG.sync.read(readFileSync(`preview/frames/${file}.png`));
    const scale = Math.min(60 / src.height, 60 / src.width);
    const width = Math.round(src.width * scale), height = Math.round(src.height * scale);
    const left = column * CELL + Math.floor((CELL - width) / 2);
    const top = row * CELL + CELL - height;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      // Average covered pixels to remove JPEG fringes when reducing the art.
      let r = 0, g = 0, b = 0, kept = 0, total = 0;
      for (let sy = Math.floor(y / scale); sy < Math.min(src.height, Math.ceil((y + 1) / scale)); sy++) {
        for (let sx = Math.floor(x / scale); sx < Math.min(src.width, Math.ceil((x + 1) / scale)); sx++) {
          const i = (sy * src.width + sx) * 4;
          total++;
          if (!src.data[i + 3]) continue;
          const [red, green, blue] = src.data.subarray(i, i + 3);
          if (red > 120 && blue > 120 && green < Math.min(red, blue) - 35) continue;
          r += red; g += green; b += blue; kept++;
        }
      }
      if (kept <= total * 0.5) continue;
      const dst = ((top + y) * sheet.width + left + x) * 4;
      sheet.data[dst] = Math.round(r / kept);
      sheet.data[dst + 1] = Math.round(g / kept);
      sheet.data[dst + 2] = Math.round(b / kept);
      sheet.data[dst + 3] = 255;
    }
  }));
  writeFileSync(`public/assets/scene/${name}-walk.png`, PNG.sync.write(sheet));
  const face = new PNG({ width: 40, height: 32 });
  PNG.bitblt(sheet, face, 12, 2, 40, 32, 0, 0);
  writeFileSync(`public/assets/scene/${name}-walk-face.png`, PNG.sync.write(face));
  console.log(`${name}: 256x128 walk sheet + matching portrait`);
}
