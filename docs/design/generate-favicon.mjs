import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const webRequire = createRequire(new URL("../../app/web/package.json", import.meta.url));
const sharp = createRequire(webRequire.resolve("next/package.json"))("sharp");
const iconSource = fileURLToPath(new URL("./tap-to-home-icon-source.png", import.meta.url));
const splashSource = fileURLToPath(new URL("./tap-to-home-splash-source.png", import.meta.url));
const webApp = new URL("../../app/web/src/app/", import.meta.url);
const androidRes = new URL("../../app/mobile/android/app/src/main/res/", import.meta.url);
const iosAssets = new URL("../../app/mobile/ios/Runner/Assets.xcassets/", import.meta.url);
const mobileImages = new URL("../../app/mobile/assets/images/", import.meta.url);

async function iconPng(size, { rgba = false } = {}) {
  // Next.js/Turbopack's ICO decoder requires RGBA PNG entries, including opaque icons.
  let pipeline = sharp(iconSource).resize(size, size, { fit: "cover" });
  if (rgba) pipeline = pipeline.ensureAlpha();
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

for (const [name, size] of [["icon.png", 512], ["apple-icon.png", 180]]) {
  await writeFile(new URL(name, webApp), await iconPng(size, { rgba: true }));
}

const sizes = [16, 32, 48, 64, 128, 256];
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
const entries = [];
const images = [];
let offset = header.length + sizes.length * 16;

for (const size of sizes) {
  const image = await iconPng(size, { rgba: true });
  assert.equal(image[25], 6, "ICO entries must use RGBA PNG color type 6");
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

await writeFile(new URL("favicon.ico", webApp), Buffer.concat([header, ...entries, ...images]));

const androidIcons = [
  ["mipmap-mdpi/ic_launcher.png", 48],
  ["mipmap-hdpi/ic_launcher.png", 72],
  ["mipmap-xhdpi/ic_launcher.png", 96],
  ["mipmap-xxhdpi/ic_launcher.png", 144],
  ["mipmap-xxxhdpi/ic_launcher.png", 192],
];
for (const [path, size] of androidIcons) {
  await writeFile(new URL(path, androidRes), await iconPng(size));
}

const iosIconSet = new URL("AppIcon.appiconset/", iosAssets);
const iosIconManifest = JSON.parse(await readFile(new URL("Contents.json", iosIconSet), "utf8"));
for (const image of iosIconManifest.images) {
  if (!image.filename || !image.size || !image.scale) continue;
  const points = Number.parseFloat(image.size.split("x")[0]);
  const scale = Number.parseFloat(image.scale);
  await writeFile(new URL(image.filename, iosIconSet), await iconPng(Math.round(points * scale)));
}

async function splashPng(width, height) {
  const scene = await sharp(splashSource)
    .resize({ width })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const sceneHeight = (await sharp(scene).metadata()).height;
  assert.ok(sceneHeight && sceneHeight <= height, "Splash scene must fit inside the target canvas");
  const top = Math.floor((height - sceneHeight) / 2);
  const bottom = height - sceneHeight - top;
  const topPaper = await sharp(scene)
    .extract({ left: 0, top: 0, width, height: top })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const bottomPaper = await sharp(scene)
    .extract({ left: 0, top: sceneHeight - bottom, width, height: bottom })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#fffdf5" } })
    .composite([
      { input: topPaper, left: 0, top: 0 },
      { input: scene, left: 0, top },
      { input: bottomPaper, left: 0, top: top + sceneHeight },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const androidDrawable = new URL("drawable-nodpi/", androidRes);
await mkdir(androidDrawable, { recursive: true });
await mkdir(mobileImages, { recursive: true });
const runtimeSplash = await splashPng(1080, 2340);
await writeFile(new URL("launch_image.png", androidDrawable), runtimeSplash);
await writeFile(new URL("splash.png", mobileImages), runtimeSplash);

const iosLaunchSet = new URL("LaunchImage.imageset/", iosAssets);
for (const [name, width, height] of [
  ["LaunchImage.png", 390, 844],
  ["LaunchImage@2x.png", 780, 1688],
  ["LaunchImage@3x.png", 1170, 2532],
]) {
  await writeFile(new URL(name, iosLaunchSet), await splashPng(width, height));
}

console.log("Generated web, Android, and iOS icons plus native and Flutter splash images.");
