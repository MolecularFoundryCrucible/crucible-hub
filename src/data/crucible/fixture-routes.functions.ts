import { createServerFn } from "@tanstack/react-start"

import { readWorkspaceConfiguration } from "./workspace-config.server"

export const getFixtureRoutesEnabled = createServerFn({
  method: "GET",
}).handler(() => readWorkspaceConfiguration().mode === "fixture")
