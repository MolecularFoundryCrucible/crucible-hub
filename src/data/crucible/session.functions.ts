import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

import { hubSessionIdentity } from "@/server/crucible/hub-auth.server"

export const getHubSessionIdentity = createServerFn({ method: "GET" }).handler(
  () => {
    setResponseHeader("Cache-Control", "no-store")
    return hubSessionIdentity()
  }
)
