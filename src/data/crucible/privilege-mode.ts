import { z } from "zod"

import type { components } from "@/generated/crucible-api"

export const privilegeModeSchema = z.enum(["normal", "elevated"])

export type WorkspacePrivilegeMode = components["schemas"]["PrivilegeMode"]
