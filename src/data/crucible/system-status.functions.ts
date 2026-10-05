import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { queryCancellationMiddleware } from "./query-cancellation"
import { readSystemStatus } from "./system-status.server"

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ bypassCache: z.boolean().optional() }).default({}))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return readSystemStatus(context.requestSignal, data.bypassCache)
  })
