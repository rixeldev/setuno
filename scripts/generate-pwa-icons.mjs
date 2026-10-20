// Generates the installable web app's icons (roadmap #77) into `public/icons`:
//   icon-192.png          the "any" icon a home screen shows
//   icon-512.png          the same, at the size a splash screen wants
//   icon-maskable-512.png the Android adaptive variant: the glyph inside the
//                         safe zone, the gradient at full bleed
//
// The brand mark and the gradient come from `assets/` (the same sources the
// Android launcher icons use), so a change there reaches the web too.
//
// Usage: node scripts/generate-pwa-icons.mjs
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const assetsDir = join(root, "assets")
const outDir = join(root, "public", "icons")

/** The glyph fills this share of the canvas on a maskable icon. */
const MASKABLE_GLYPH = 0.58

/** Draws an image centered in a square canvas, scaled to `share` of it. */
const drawCentered = (ctx, image, size, share) => {
  const target = size * share
  const scale = Math.min(target / image.width, target / image.height)
  const width = image.width * scale
  const height = image.height * scale
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
}

const main = async () => {
  const [icon, background, foreground] = await Promise.all([
    loadImage(join(assetsDir, "icon.png")),
    loadImage(join(assetsDir, "icon-background.png")),
    loadImage(join(assetsDir, "icon-foreground.png")),
  ])

  mkdirSync(outDir, { recursive: true })

  for (const size of [192, 512]) {
    const canvas = createCanvas(size, size)
    canvas.getContext("2d").drawImage(icon, 0, 0, size, size)
    writeFileSync(join(outDir, `icon-${size}.png`), canvas.toBuffer("image/png"))
  }

  // Maskable: the platform may crop the icon to any shape, so the gradient
  // fills the canvas and the glyph stays inside the safe zone.
  const maskable = createCanvas(512, 512)
  const ctx = maskable.getContext("2d")
  ctx.drawImage(background, 0, 0, 512, 512)
  drawCentered(ctx, foreground, 512, MASKABLE_GLYPH)
  writeFileSync(join(outDir, "icon-maskable-512.png"), maskable.toBuffer("image/png"))

  for (const file of ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
    const path = join(outDir, file)
    if (!existsSync(path)) throw new Error(`missing ${path}`)
    console.log(`  ${file}`)
  }
  console.log("PWA icons written to", outDir)
}

await main()
