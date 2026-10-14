// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")

module.exports = defineConfig([
  expoConfig,
  // Flat-config ignores are per-object: a list mixed into the `rules` object
  // only scopes those rules. Its own object makes them global, so the build
  // output and the node-only scripts stay out of the linter.
  {
    ignores: ["dist/*", "scripts/*", ".expo/*"],
  },
  {
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      semi: ["error", "never"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
])
