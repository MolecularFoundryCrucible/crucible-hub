import { describe, expect, it } from "vitest"

import { hubLoginHref } from "./hub-login-link"

describe("hubLoginHref", () => {
  it("stays relative when no sign-in address is configured", () => {
    expect(hubLoginHref(null)).toBe("/hub/auth/login")
  })

  it("starts on the configured address so the login cookie reaches the callback", () => {
    expect(hubLoginHref("https://hub.example.test")).toBe(
      "https://hub.example.test/hub/auth/login"
    )
  })

  it("keeps the return path", () => {
    expect(hubLoginHref("https://hub.example.test", "/hub/data?a=1")).toBe(
      "https://hub.example.test/hub/auth/login?returnTo=%2Fhub%2Fdata%3Fa%3D1"
    )
  })
})
