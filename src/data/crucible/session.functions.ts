import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

import {
  hubSessionIdentity,
  hubSignInOrigin,
} from "@/server/crucible/hub-auth.server"
import { readGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"

export const getHubSignInOrigin = createServerFn({ method: "GET" }).handler(
  () => hubSignInOrigin()
)

export const getHubSessionSnapshot = createServerFn({ method: "GET" }).handler(
  () => {
    setResponseHeader("Cache-Control", "no-store")
    const accountMfid = hubSessionIdentity()
    return accountMfid
      ? { accountMfid, privilegeMode: readGlobalPrivilegeMode() }
      : null
  }
)
