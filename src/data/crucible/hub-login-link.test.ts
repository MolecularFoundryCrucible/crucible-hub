import { describe, expect, it } from "vitest"

import { hubLoginHref, hubSignInChoices } from "./hub-login-link"

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

  it("names the chosen sign-in provider", () => {
    expect(hubLoginHref(null, "/hub/data", "orcid")).toBe(
      "/hub/auth/login?returnTo=%2Fhub%2Fdata&provider=orcid"
    )
    expect(hubLoginHref(null, undefined, "orcid")).toBe(
      "/hub/auth/login?provider=orcid"
    )
  })
})

describe("hubSignInChoices", () => {
  const orcid = { display_name: "ORCID", is_orcid: true, key: "orcid" }
  const lab = { display_name: "Berkeley Lab", is_orcid: false, key: "lbl" }

  it("offers a neutral button when the methods are unknown", () => {
    expect(hubSignInChoices(null, null)).toEqual([
      { href: "/hub/auth/login", isOrcid: false, label: "Sign in" },
    ])
    expect(hubSignInChoices([], null)).toEqual([
      { href: "/hub/auth/login", isOrcid: false, label: "Sign in" },
    ])
  })

  it("names a single method and lets the API pick it", () => {
    expect(hubSignInChoices([orcid], null, "/hub/data")).toEqual([
      {
        href: "/hub/auth/login?returnTo=%2Fhub%2Fdata",
        isOrcid: true,
        label: "Sign in with ORCID",
      },
    ])
  })

  it("offers each method by its key when there are several", () => {
    expect(hubSignInChoices([orcid, lab], "https://hub.example.test")).toEqual([
      {
        href: "https://hub.example.test/hub/auth/login?provider=orcid",
        isOrcid: true,
        label: "Sign in with ORCID",
      },
      {
        href: "https://hub.example.test/hub/auth/login?provider=lbl",
        isOrcid: false,
        label: "Sign in with Berkeley Lab",
      },
    ])
  })
})
