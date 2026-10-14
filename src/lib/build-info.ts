export type HubBuild = {
  commit?: string
  development: boolean
  version: string
}

const commit: unknown = import.meta.env.VITE_GIT_COMMIT

export const hubBuild: HubBuild = {
  commit: typeof commit === "string" && commit.length > 0 ? commit : undefined,
  development: import.meta.env.DEV,
  version: import.meta.env.VITE_APP_VERSION,
}
