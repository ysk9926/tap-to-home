# Tap to Home app icon and splash

2026-09-22 · Built-in `image_gen` tool · Two generated raster masters.

## Outputs

- Icon master: `tap-to-home-icon-source.png` (1254×1254).
- Splash master: `tap-to-home-splash-source.png` (1024×1536).
- `generate-favicon.mjs` derives the web favicon and metadata icons, Android launcher icons, iOS AppIcon set, Android/iOS native splash images, and Flutter loading splash.
- Run `node docs/design/generate-favicon.mjs` from the workspace root after either master changes. The script uses Next.js's installed Sharp dependency. Turbopack's ICO decoder requires RGBA PNG entries, including opaque artwork.

## Icon prompt

```text
Use case: logo-brand
Asset type: square master artwork for a mobile app launcher icon, Apple touch icon, and web favicon
Primary request: create a NEW Tap to Home icon on a ruled notebook-paper background. Use Image 1 only as a reference for the warm ivory, black-marker, yellow-highlighter palette and handmade line character; do not preserve its composition.
Scene/backdrop: warm ivory notebook paper (#fffdf5), with sparse pale blue horizontal ruled lines and one muted pink-red vertical margin line, visibly hand-drawn but clean.
Subject: one bold, simple house outline drawn with thick rounded slightly imperfect nearly-black marker (#1f1f1f). Inside the house, place the exact app name on three centered lines:
"Tap"
"To"
"Home"
Style/medium: compact flat hand-drawn logo, matching a playful pencil-and-marker notebook doodle UI.
Composition/framing: 1:1 square, centered, strong silhouette, generous safe margin for iOS and Android rounded icon masks; house occupies about 72% of the canvas; all three words remain large and readable after downscaling.
Color palette: ivory paper, pale blue rules, muted pink-red margin line, nearly black marker, and one warm yellow highlighter accent (#ffe86b) behind the words.
Text (verbatim): "Tap To Home". Render exactly once as three lines: Tap / To / Home. T-a-p, T-o, H-o-m-e. Preserve spelling and capitalization exactly.
Constraints: full opaque background; simple enough to read at 48px; no running figure; no other text; no letters outside the house; no watermark; original design only.
Avoid: gradients, shadows, 3D, glossy effects, photorealism, excessive paper grain, tiny decorations, clipped roof, mockup presentation.
```

## Splash prompt

```text
Use case: illustration-story
Asset type: portrait mobile app splash screen master artwork
Primary request: create a NEW portrait splash illustration for Tap to Home showing the joy and urgency of leaving work: one lively stick figure sprinting away from a simple office doorway toward a welcoming hand-drawn house.
Input images: Image 1 is a style and palette reference only, not an edit target.
Scene/backdrop: full-frame warm ivory ruled notebook paper (#fffdf5), pale blue horizontal lines across the whole canvas, and one muted pink-red vertical notebook margin line.
Subject: exactly one thin pencil-line stick figure in a dynamic full-body running pose, moving from the small office doorway toward the house; a few simple pencil motion strokes; office and house remain secondary simple doodles.
Style/medium: playful Korean notebook doodle, thin graphite-like pencil character lines plus slightly thicker black marker architecture, consistent with a handmade app UI; flat raster illustration.
Composition/framing: vertical 2:3 portrait canvas, centered visual story in the middle safe area; ample breathing room near every edge so it can crop safely on different phone aspect ratios; character is the clear focal point.
Color palette: ivory paper, pale blue notebook rules, muted pink-red margin line, charcoal pencil/marker, and one restrained warm yellow highlighter swipe suggesting the route home.
Lighting/mood: bright, lighthearted, relieved, energetic.
Constraints: no text, no letters, no logo, no watermark, exactly one stick figure, full opaque background, no UI chrome, readable at phone startup size.
Avoid: photorealism, 3D, gradients, drop shadows, dense scenery, extra people, briefcases, cars, city skyline, detailed office furniture, mockup presentation.
```
