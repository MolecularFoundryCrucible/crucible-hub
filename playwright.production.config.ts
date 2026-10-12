import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174/hub/",
    trace: "on-first-retry",
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
