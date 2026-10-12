import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    env: { HUB_DATA_SOURCE: "fixture" },
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
