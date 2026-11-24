import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

import { hubSessionIdentity } from "@/server/crucible/hub-auth.server"
import {
  hubSignInMethods,
  hubSignInOrigin,
} from "@/server/crucible/hub-auth-config.server"
import { readGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"

export const getHubSignInOptions = createServerFn({ method: "GET" }).handler(
  async () => ({
    methods: await hubSignInMethods(),
    origin: hubSignInOrigin(),
  })
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
