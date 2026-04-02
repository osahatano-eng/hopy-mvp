// /scripts/gen-icons.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const svgPath = path.join(ROOT, "public", "icons", "icon.svg");
const outDir = path.join(ROOT, "public", "icons");

if (!fs.existsSync(svgPath)) {
  console.error("icon.svg not found:", svgPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// SVGを読み込み
const svg = fs.readFileSync(svgPath);

// 生成対象（PWA必須級）
const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },

  // maskable（Android/一部環境で“本物アプリ感”が上がる）
  { name: "maskable-192.png", size: 192 },
  { name: "maskable-512.png", size: 512 },
];

for (const t of targets) {
  const outPath = path.join(outDir, t.name);
  await sharp(svg, { density: 300 })
    .resize(t.size, t.size, { fit: "cover" })
    .png()
    .toFile(outPath);
  console.log("✅ wrote:", outPath);
}

// iOS用（ホーム画面アイコンとしてSafariが探す）
const applePath = path.join(ROOT, "public", "apple-touch-icon.png");
await sharp(svg, { density: 300 })
  .resize(180, 180, { fit: "cover" })
  .png()
  .toFile(applePath);
console.log("✅ wrote:", applePath);

// 互換用（あなたのログに /icon.png 200 が出ていたので維持）
const legacyIcon = path.join(ROOT, "public", "icon.png");
await sharp(svg, { density: 300 })
  .resize(512, 512, { fit: "cover" })
  .png()
  .toFile(legacyIcon);
console.log("✅ wrote:", legacyIcon);

console.log("🎉 done");