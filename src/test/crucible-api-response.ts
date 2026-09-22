import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"

export function crucibleApiResponse(
  data: unknown,
  init: ResponseInit = {},
  privilegeMode: WorkspacePrivilegeMode = "normal"
) {
  const headers = new Headers(init.headers)
  headers.set("Crucible-Privilege-Mode", privilegeMode)
  return Response.json(data, { ...init, headers })
}
