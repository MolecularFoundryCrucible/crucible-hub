import { definePlugin } from "nitro"

import { assertSecretSettingsGivenOnce } from "../crucible/deployment-settings.server"

export default definePlugin(() => {
  assertSecretSettingsGivenOnce()
})
