import "@tanstack/react-start/server-only"

import { getCookie, setCookie } from "@tanstack/react-start/server"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import {
  sharedRequestPrivilegeMode,
  updateSharedPrivilegeMode,
} from "./hub-auth.server"
import { CrucibleResponseError } from "./request-error.server"

import {
  privilegeModeCookie,
  privilegeModeCookieOptions,
  clearLegacyPrivilegeModeCookie,
} from "./privilege-mode-cookie.server"

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

  setCookie(privilegeModeCookie, mode, privilegeModeCookieOptions())
}

export function requireAdministratorView() {
  if (readGlobalPrivilegeMode() !== "elevated") {
    throw new CrucibleResponseError(403)
  }
  return "elevated" as const
}
