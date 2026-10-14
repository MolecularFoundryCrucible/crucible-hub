import "@tanstack/react-start/server-only"

import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server"

import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import {
  hubAuthPublicOrigin,
  sharedRequestPrivilegeMode,
  updateSharedPrivilegeMode,
} from "./hub-auth.server"
import { CrucibleResponseError } from "./request-error.server"

const privilegeModeCookie = "crucible_hub_administrator_view"

function cookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: new URL(hubAuthPublicOrigin()).protocol === "https:",
  }
}

export function clearLegacyPrivilegeModeCookie() {
  deleteCookie(privilegeModeCookie, cookieOptions())
}

export function readGlobalPrivilegeMode(): WorkspacePrivilegeMode {
  const shared = sharedRequestPrivilegeMode()
  if (shared) return shared
  try {
    return getCookie(privilegeModeCookie) === "elevated" ? "elevated" : "normal"
  } catch {
    return "normal"
  }
}

export async function writeGlobalPrivilegeMode(mode: WorkspacePrivilegeMode) {
  if (await updateSharedPrivilegeMode(mode)) return
  if (mode === "normal") {
    clearLegacyPrivilegeModeCookie()
    return
  }

  setCookie(privilegeModeCookie, mode, cookieOptions())
}

export function requireAdministratorView() {
  if (readGlobalPrivilegeMode() !== "elevated") {
    throw new CrucibleResponseError(403)
  }
  return "elevated" as const
}
