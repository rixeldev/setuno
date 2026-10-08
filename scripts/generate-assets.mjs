// Generates the Android launcher icon set in `assets/icons` from the brand
// masters, replacing whatever is there on every run:
//
//   assets/icon-background.png   gradient background layer
//   assets/icon-foreground.png   note glyph at full bleed (also copied as the
//                                1024 `ic_launcher_foreground.png`)
//   assets/icon.png              composed brand mark (source for `ic_brand`)
//
// For each density it writes the legacy square/round tile, the adaptive
// background/foreground/monochrome layers and refreshes the `mipmap-anydpi-v26`
// XMLs. The numbers below were calibrated against the original exports so a
// regeneration keeps the artwork in place: the adaptive glyph is 53.1% of the
// master's, the legacy tile is inset 6.25% with a superellipse corner
// (exponent 3) and carries the glyph at 69.15%.
//
// Usage: pnpm assets:generate
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const assetsDir = join(root, "assets")
const iconsDir = join(assetsDir, "icons")

/** Legacy tile size and adaptive layer size (108dp) per density. */
const DENSITIES = [
  { name: "mdpi", tile: 48, layer: 108 },
  { name: "hdpi", tile: 72, layer: 162 },
  { name: "xhdpi", tile: 96, layer: 216 },
  { name: "xxhdpi", tile: 144, layer: 324 },
  { name: "xxxhdpi", tile: 192, layer: 432 },
]

const ADAPTIVE_GLYPH = 0.531
const LEGACY_GLYPH = 0.6915
const TILE_INSET = 0.0625
const TILE_EXPONENT = 3
const TILE_SHADOW = { alpha: 0.32, blur: 0.052, offsetY: 0.021 }

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>`

/** Draws a square image scaled by `fraction` and centred on the canvas. */
const drawCentered = (ctx, image, size, fraction) => {
  const side = size * fraction
  const offset = (size - side) / 2
  ctx.drawImage(image, offset, offset, side, side)
}

/**
 * iOS-style superellipse tile (`|x/a|^n + |y/a|^n = 1`). A plain rounded
 * rectangle is not enough: the corners of the current exports bulge out of a
 * circle fit and sit on an exponent 3 curve.
 */
const tilePath = (ctx, size, inset, exponent) => {
  const center = size / 2
  const radius = center - inset * size
  const steps = 144
  ctx.beginPath()
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const x = center + Math.sign(cos) * Math.pow(Math.abs(cos), 2 / exponent) * radius
    const y = center + Math.sign(sin) * Math.pow(Math.abs(sin), 2 / exponent) * radius
    if (step === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Legacy launcher tile: shadowed superellipse + gradient + glyph, inset. */
const buildTile = (size, background, foreground) => {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")

  // Soft drop shadow under the tile.
  ctx.save()
  ctx.shadowColor = `rgba(0, 0, 0, ${TILE_SHADOW.alpha})`
  ctx.shadowBlur = size * TILE_SHADOW.blur
  ctx.shadowOffsetY = size * TILE_SHADOW.offsetY
  ctx.fillStyle = "#000000"
  tilePath(ctx, size, TILE_INSET, TILE_EXPONENT)
  ctx.fill()
  ctx.restore()

  // Tile content, clipped to the same shape.
  ctx.save()
  tilePath(ctx, size, TILE_INSET, TILE_EXPONENT)
  ctx.clip()
  ctx.drawImage(background, 0, 0, size, size)
  drawCentered(ctx, foreground, size, LEGACY_GLYPH)
  ctx.restore()

  return canvas
}

/** Adaptive background layer: the gradient at full bleed. */
const buildAdaptiveBackground = (size, background) => {
  const canvas = createCanvas(size, size)
  canvas.getContext("2d").drawImage(background, 0, 0, size, size)
  return canvas
}

/** Adaptive foreground layer: the glyph inside the safe zone. */
const buildAdaptiveForeground = (size, foreground) => {
  const canvas = createCanvas(size, size)
  drawCentered(canvas.getContext("2d"), foreground, size, ADAPTIVE_GLYPH)
  return canvas
}

/**
 * Themed-icon layer: the glyph and bars without the drop shadow. Shadow pixels
 * are dark, so a luminance cut keeps only the flat cream shape.
 */
const buildMonochrome = (size, foreground) => {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")
  drawCentered(ctx, foreground, size, ADAPTIVE_GLYPH)
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    if (data[index + 3] > 0 && luminance < 120) data[index + 3] = 0
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

const main = async () => {
  const [icon, background, foreground] = await Promise.all([
    loadImage(join(assetsDir, "icon.png")),
    loadImage(join(assetsDir, "icon-background.png")),
    loadImage(join(assetsDir, "icon-foreground.png")),
  ])

  // Replace the whole set: leftovers from older layouts disappear too.
  rmSync(iconsDir, { recursive: true, force: true })
  mkdirSync(join(iconsDir, "mipmap-anydpi-v26"), { recursive: true })
  writeFileSync(join(iconsDir, "mipmap-anydpi-v26", "ic_launcher.xml"), ADAPTIVE_ICON_XML)
  writeFileSync(join(iconsDir, "mipmap-anydpi-v26", "ic_launcher_round.xml"), ADAPTIVE_ICON_XML)

  // The 1024 master ships as-is, plus the composed brand mark used by docs.
  copyFileSync(join(assetsDir, "icon-foreground.png"), join(iconsDir, "ic_launcher_foreground.png"))
  const brand = createCanvas(512, 512)
  brand.getContext("2d").drawImage(icon, 0, 0, 512, 512)
  writeFileSync(join(iconsDir, "ic_brand.png"), brand.toBuffer("image/png"))

  for (const density of DENSITIES) {
    const dir = join(iconsDir, `mipmap-${density.name}`)
    mkdirSync(dir, { recursive: true })

    // Square and round share the same tile: Android applies the final mask.
    const tile = buildTile(density.tile, background, foreground).toBuffer("image/png")
    writeFileSync(join(dir, "ic_launcher.png"), tile)
    writeFileSync(join(dir, "ic_launcher_round.png"), tile)

    writeFileSync(
      join(dir, "ic_launcher_background.png"),
      buildAdaptiveBackground(density.layer, background).toBuffer("image/png"),
    )
    writeFileSync(
      join(dir, "ic_launcher_foreground.png"),
      buildAdaptiveForeground(density.layer, foreground).toBuffer("image/png"),
    )
    writeFileSync(
      join(dir, "ic_launcher_monochrome.png"),
      buildMonochrome(density.layer, foreground).toBuffer("image/png"),
    )

    console.log(`  mipmap-${density.name}: ${density.tile}px tile + ${density.layer}px layers`)
  }

  console.log(`Icons written to ${iconsDir}`)
}

main().catch((error) => {
  console.error(`Icon generation failed: ${error.message}`)
  process.exitCode = 1
})
