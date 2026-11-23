import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseEnv } from "node:util"

const root = resolve(import.meta.dirname, "..")
const scenario = process.argv[2]
const names = new Set([
  "fixtures",
  "api-local",
  "api-staging",
  "api-main",
  "orcid-local",
  "orcid-staging",
])

if (!names.has(scenario)) {
  throw new Error(`Choose one development scenario: ${[...names].join(", ")}`)
}

const scenarioValues = parseEnv(
  readFileSync(resolve(root, "config", "env", `${scenario}.env`), "utf8")
)
const environment = { ...process.env }

for (const key of [
  "HUB_DATA_SOURCE",
  "CRUCIBLE_API_BASE_URL",
  "CRUCIBLE_API_KEY",
  "HUB_AUTH_PUBLIC_API_URL",
  "HUB_AUTH_CALLBACK_URI",
  "HUB_AUTH_CLIENT_SECRET",
  "HUB_AUTH_PRODUCTION_ENABLED",
  "HUB_AUTH_SESSION_MODE",
  "HUB_SESSION_DATABASE_URL",
  "HUB_SESSION_DATABASE_INSTANCE",
  "HUB_SESSION_DATABASE_NAME",
  "HUB_SESSION_DATABASE_USER",
  "HUB_SESSION_DATABASE_PASSWORD",
  "HUB_SESSION_KEYS",
  "HUB_ACCOUNT_PREFERENCES_ENABLED",
  "NODE_EXTRA_CA_CERTS",
  "NODE_ENV",
]) {
  delete environment[key]
}

function scenarioCredentials() {
  const file = `.env.${scenario}.local`
  const path = resolve(root, file)
  if (!existsSync(path)) {
    throw new Error(`Create the gitignored ${file} credential file.`)
  }
  const credentials = parseEnv(readFileSync(path, "utf8"))
  return (name, { optional = false } = {}) => {
    if (!credentials[name] && !optional) {
      throw new Error(`Set ${name} in ${file}.`)
    }
    return credentials[name]
  }
}

let callbackOverride
let publicApiOverride

if (scenario !== "fixtures") {
  const credential = scenarioCredentials()
  if (scenario.startsWith("api-")) {
    environment.CRUCIBLE_API_KEY = credential("CRUCIBLE_API_KEY")
  } else {
    environment.HUB_AUTH_CLIENT_SECRET = credential("HUB_AUTH_CLIENT_SECRET")
    callbackOverride = credential("HUB_AUTH_CALLBACK_URI", { optional: true })
    publicApiOverride = credential("HUB_AUTH_PUBLIC_API_URL", {
      optional: true,
    })
  }
  if (scenario.endsWith("-local")) {
    environment.NODE_EXTRA_CA_CERTS = credential("NODE_EXTRA_CA_CERTS")
  }
}

Object.assign(environment, scenarioValues)
if (callbackOverride) environment.HUB_AUTH_CALLBACK_URI = callbackOverride
if (publicApiOverride) environment.HUB_AUTH_PUBLIC_API_URL = publicApiOverride
if (scenario.startsWith("orcid-")) {
  for (const name of ["HUB_AUTH_CALLBACK_URI", "HUB_AUTH_PUBLIC_API_URL"]) {
    if (!environment[name]) {
      throw new Error(`Set ${name} in .env.${scenario}.local.`)
    }
  }
  const callbackHost = new URL(environment.HUB_AUTH_CALLBACK_URI).hostname
  if (callbackHost !== "localhost" && callbackHost !== "127.0.0.1") {
    environment.HUB_DEV_ALLOWED_HOSTS ||= callbackHost
  }
}

const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "dev"],
  {
    cwd: root,
    env: environment,
    stdio: "inherit",
  }
)

child.on("error", (error) => {
  throw error
})
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
