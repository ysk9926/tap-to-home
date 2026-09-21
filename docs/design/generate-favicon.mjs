import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const webRequire = createRequire(new URL("../../app/web/package.json", import.meta.url));
const sharp = createRequire(webRequire.resolve("next/package.json"))("sharp");
const source = fileURLToPath(new URL("./tap-to-home-icon-source.png", import.meta.url));
const app = new URL("../../app/web/src/app/", import.meta.url);

async function png(size) {
  // Next.js/Turbopack's ICO decoder requires RGBA PNG entries, including opaque icons.
  const result = await sharp(source).resize(size, size).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
  assert.equal(result[25], 6, "ICO entries must use RGBA PNG color type 6");
  return result;
}

for (const [name, size] of [["icon.png", 512], ["apple-icon.png", 180]]) {
  await writeFile(new URL(name, app), await png(size));
}

const sizes = [16, 32, 48, 64, 128, 256];
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
const entries = [];
const images = [];
let offset = header.length + sizes.length * 16;

for (const size of sizes) {
  const image = await png(size);
  const entry = Buffer.alloc(16);
  entry[0] = entry[1] = size % 256;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  images.push(image);
  offset += image.length;
}

await writeFile(new URL("favicon.ico", app), Buffer.concat([header, ...entries, ...images]));
console.log("Generated icon.png, apple-icon.png, and six RGBA favicon.ico resolutions.");
