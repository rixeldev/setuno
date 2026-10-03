// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "scripts/*", ".expo/*"],
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      semi: ["error", "never"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
])
