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
  "HUB_SESSION_REDIS_URL",
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

if (scenario.startsWith("api-")) {
  const specificKeyFile = resolve(root, `.env.${scenario}.local`)
  const keyFile = existsSync(specificKeyFile)
    ? specificKeyFile
    : resolve(root, ".env.api-key.local")
  const credentials = existsSync(keyFile)
    ? parseEnv(readFileSync(keyFile, "utf8"))
    : {}
  environment.CRUCIBLE_API_KEY =
    credentials.CRUCIBLE_API_KEY || process.env.CRUCIBLE_API_KEY || ""
  if (!environment.CRUCIBLE_API_KEY) {
    throw new Error(
      "Set CRUCIBLE_API_KEY in the scenario credential file or your shell."
    )
  }
  if (scenario === "api-local") {
    const legacyCertificateFile = resolve(root, ".env.hub-auth.local")
    const legacyCertificate = existsSync(legacyCertificateFile)
      ? parseEnv(readFileSync(legacyCertificateFile, "utf8"))
          .NODE_EXTRA_CA_CERTS
      : undefined
    environment.NODE_EXTRA_CA_CERTS =
      credentials.NODE_EXTRA_CA_CERTS ||
      legacyCertificate ||
      process.env.NODE_EXTRA_CA_CERTS ||
      ""
  }
}

let callbackOverride
let publicApiOverride

if (scenario.startsWith("orcid-")) {
  const specificCredentialFile = resolve(root, `.env.${scenario}.local`)
  const credentialFile = existsSync(specificCredentialFile)
    ? specificCredentialFile
    : resolve(root, ".env.hub-auth.local")
  if (!existsSync(credentialFile)) {
    throw new Error(
      `Create a gitignored .env.${scenario}.local credential file.`
    )
  }
  const credentials = parseEnv(readFileSync(credentialFile, "utf8"))
  if (credentialFile === specificCredentialFile || scenario === "orcid-local") {
    callbackOverride = credentials.HUB_AUTH_CALLBACK_URI
    publicApiOverride = credentials.HUB_AUTH_PUBLIC_API_URL
  }
  environment.HUB_AUTH_CLIENT_SECRET = credentials.HUB_AUTH_CLIENT_SECRET || ""
  if (!environment.HUB_AUTH_CLIENT_SECRET) {
    throw new Error(
      "Set HUB_AUTH_CLIENT_SECRET in the scenario credential file."
    )
  }
  if (scenario === "orcid-local") {
    environment.NODE_EXTRA_CA_CERTS =
      credentials.NODE_EXTRA_CA_CERTS || process.env.NODE_EXTRA_CA_CERTS || ""
  }
}

if (scenario.endsWith("local") && !environment.NODE_EXTRA_CA_CERTS) {
  throw new Error("Set NODE_EXTRA_CA_CERTS to the local API certificate.")
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
