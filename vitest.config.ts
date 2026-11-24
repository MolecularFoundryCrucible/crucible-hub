import { defineConfig } from "vitest/config"

const serverTests = [
  "src/{server,data,lib}/**/*.test.ts",
  "src/**/*.server.test.ts",
]

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    env: { HUB_DATA_SOURCE: "fixture" },
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: serverTests,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: serverTests,
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
  },
})
