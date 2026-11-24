import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4174/hub/",
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start",
    env: {
      HOST: "127.0.0.1",
      HUB_DATA_SOURCE: "fixture",
      HUB_ENABLE_FIXTURES: "true",
      NODE_ENV: "production",
      PORT: "4174",
    },
    url: "http://127.0.0.1:4174/hub/health",
    reuseExistingServer: false,
  },
})
