import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Guard against deprecated react-native-web props creeping back in.
 *
 * `pointerEvents` must live in the style (the prop logs
 * "props.pointerEvents is deprecated" on web). The sources are read as text
 * because importing React Native is not possible in the unit project.
 */
const walk = (dir: string): string[] => {
  const entries: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) entries.push(...walk(full))
    else if (/\.(t|j)sx?$/.test(name)) entries.push(full)
  }
  return entries
}

describe("react-native-web deprecations", () => {
  it("never passes pointerEvents as a prop", () => {
    const files = [...walk(join(process.cwd(), "app")), ...walk(join(process.cwd(), "components"))]
    const offenders = files.filter((file) => /pointerEvents=/.test(readFileSync(file, "utf8")))

    expect(offenders, `Use style={{ pointerEvents }} in: ${offenders.join(", ")}`).toEqual([])
  })
})
