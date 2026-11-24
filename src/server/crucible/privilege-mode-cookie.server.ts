import "@tanstack/react-start/server-only"

import { deleteCookie } from "@tanstack/react-start/server"
import { hubAuthPublicOrigin } from "./hub-auth-config.server"

export const privilegeModeCookie = "crucible_hub_administrator_view"

export function privilegeModeCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: new URL(hubAuthPublicOrigin()).protocol === "https:",
  }
}

export function clearLegacyPrivilegeModeCookie() {
  deleteCookie(privilegeModeCookie, privilegeModeCookieOptions())
}
