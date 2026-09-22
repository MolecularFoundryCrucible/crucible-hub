import "@tanstack/react-start/server-only"

import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
} from "@tanstack/react-start/server"

import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"

const privilegeModeCookie = "crucible_hub_administrator_view"

export function readGlobalPrivilegeMode(): WorkspacePrivilegeMode {
  try {
    return getCookie(privilegeModeCookie) === "elevated" ? "elevated" : "normal"
  } catch {
    return "normal"
  }
}

export function writeGlobalPrivilegeMode(mode: WorkspacePrivilegeMode) {
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: new URL(getRequest().url).protocol === "https:",
  }

  if (mode === "normal") {
    deleteCookie(privilegeModeCookie, options)
    return
  }

  setCookie(privilegeModeCookie, mode, options)
}
