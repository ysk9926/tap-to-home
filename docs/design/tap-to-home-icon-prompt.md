# Tap to Home favicon

2026-09-21 · Built-in `image_gen` tool · Single generated raster image.

Original: `tap-to-home-icon-source.png`. Derived files: `app/web/src/app/icon.png` (512px), `apple-icon.png` (180px), `favicon.ico` (16/32/48/64/128/256px). The generated composition is unchanged. Run `node docs/design/generate-favicon.mjs` from the workspace root to resize with Next.js's installed Sharp dependency and package RGBA PNGs in the ICO. Turbopack's ICO decoder rejects RGB-only PNG entries, even for opaque artwork.

## Final prompt

Generate one finished square favicon / web app icon for Tap to Home, a playful Korean office-worker game about a stick figure racing home. Design: a single bold hand-drawn black house outline with a simple peaked roof, and a large lively running stick figure inside, running toward the house doorway. A simple warm pale yellow highlighter fill behind the figure inside the house. Warm ivory paper background #fffdf5, nearly black marker strokes #1f1f1f, yellow #ffe86b, no other colors. Thick rounded slightly imperfect marker strokes, extremely simple compact flat logo silhouette, centered composition occupying 85 percent of the square with modest safe margins, very readable at 32x32 pixels. No text, no letters, no gradients, no shadows, no 3D, no mockup, no fine hatching, no tiny details, no texture noise, no decorations, no surrounding device. Exactly one clean icon, 1024x1024 square raster artwork, full opaque background, suitable for conversion to PNG and ICO favicon.
