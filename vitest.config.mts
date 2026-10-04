import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

/**
 * Unit tests cover the pure domain logic (chords, song documents, validation,
 * formatting, search). Integration tests cover the Firestore services against
 * the emulator and are opt-in — see `tests/integration/README.md`.
 */
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\/(.*)$/, replacement: `${root}$1` }],
  },
  test: {
    projects: [
      {
        resolve: {
          alias: [{ find: /^@\/(.*)$/, replacement: `${root}$1` }],
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: [{ find: /^@\/(.*)$/, replacement: `${root}$1` }],
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
})