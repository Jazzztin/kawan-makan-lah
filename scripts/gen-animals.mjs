// Generate ORIGINAL cute Malaysian-animal NPC sprites as pixel art.
// These are original designs (a tapir, a hornbill, an orangutan) drawn from
// parametric pixel grids — not mascots or characters from any brand/game.
//
// Output: public/assets/scene/{tapir,hornbill,orangutan}.png
// Each is a small idle sprite with a subtle 2-frame bob handled in CSS.
// Frame 20x16 (tapir/orangutan) or 16x18 (hornbill), single frame.

import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("public/assets/scene", { recursive: true });

function render(rows, palette, outfile) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const png = new PNG({ width: w, height: h });
  png.data.fill(0);
  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, ".");
    for (let x = 0; x < w; x++) {
      const c = palette[row[x]];
      if (!c) continue;
      const i = (y * w + x) << 2;
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
      png.data[i + 3] = 255;
    }
  }
  writeFileSync(outfile, PNG.sync.write(png));
  console.log(`Wrote ${outfile} (${w}x${h})`);
}

// ---- Malayan tapir: black front/rear, white "saddle" middle. Iconic. ----
const tapirPal = {
  ".": null,
  K: [26, 24, 34],     // outline / black body
  k: [52, 48, 62],     // black shade
  W: [238, 240, 245],  // white saddle
  w: [200, 204, 214],  // white shade
  E: [240, 240, 250],  // eye
  n: [70, 66, 80],     // nose
};
const tapir = [
  "...........KKKK.....",
  ".........KKkkkkK....",
  "KKKKK...KkkkkkkkK...", // head (left) + snout
  "Kkkkkk.KkkkEkkkkK...",
  "nkkkkkKkkkkkkkkkK...",
  "KkkkkWWWWWWWWkkkK...", // white saddle begins
  ".KkkWWWWWWWWWWkkkK..",
  ".KkkWWWWWWWWWWwwkK..",
  ".KkkWWWWWWWWWWwwkK..",
  ".KkkkwwwwwwwwkkkkK..",
  ".KkkkKkkkKKkkkKkkK..",
  "..KKK.KKK..KKK.KKK..", // legs
  "..K.K.K.K..K.K.K.K..",
];

// ---- Hornbill: black body, big curved yellow/orange bill + casque. ----
const hornPal = {
  ".": null,
  K: [26, 24, 34],
  B: [34, 32, 44],     // body black
  b: [60, 58, 72],     // body shade
  Y: [240, 190, 70],   // bill yellow
  O: [225, 120, 50],   // casque orange
  W: [240, 240, 248],  // white tail/eye
  E: [245, 60, 60],    // red eye ring accent
};
const hornbill = [
  "....OOOO........",
  "...OOOOOO.......",
  "..KBBBBBK.......",
  ".KBBEBBBBK......",
  ".KBBBBBBBKYYY...", // eye + bill start
  ".KBBBBBBBYYYYYY.",
  ".KbBBBBBBKYYYY..", // curved bill
  ".KBBBBBBBK......",
  ".KBBBBBbBK......",
  "..KBBBBBK.......",
  "..KWWBBWK.......", // white belly hint
  "...KK.KK........", // legs
];

// ---- Orangutan: orange shaggy body, friendly face. ----
const orangPal = {
  ".": null,
  K: [40, 24, 16],     // outline dark brown
  O: [196, 104, 44],   // orange fur
  o: [160, 80, 32],    // fur shade
  F: [120, 72, 48],    // face skin
  f: [92, 54, 36],     // face shade
  E: [30, 24, 24],     // eyes
  M: [120, 70, 60],    // mouth
};
const orangutan = [
  "..KKK....KKK...",
  ".KOOOK..KOOOK..", // tufts of hair
  ".KOOOOKKOOOOK..",
  "KOOOOOOOOOOOOK.",
  "KOoFFFFFFFFoOK.", // face
  "KOoFEFFFEFFoOK.", // eyes
  "KOoFFFFFFFFoOK.",
  "KOoFFFMMFFFfOK.", // mouth
  "KOoFFFFFFFfOOK.",
  ".KOOOOOOOOOOK..",
  ".KOoOOOOOOoOK..",
  "..KOOK..KOOK...", // arms/legs
  "..KK.K..K.KK...",
];

render(tapir, tapirPal, "public/assets/scene/tapir.png");
render(hornbill, hornPal, "public/assets/scene/hornbill.png");
render(orangutan, orangPal, "public/assets/scene/orangutan.png");
