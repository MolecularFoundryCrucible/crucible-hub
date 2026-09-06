import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const contractPath = "contracts/crucible-api.json"
const generatedPath = "src/generated/crucible-api.ts"
const lock = JSON.parse(
  readFileSync("contracts/crucible-api.lock.json", "utf8")
)
const contract = readFileSync(contractPath)
const digest = createHash("sha256").update(contract).digest("hex")

if (digest !== lock.sha256) {
  throw new Error(
    `OpenAPI digest mismatch: expected ${lock.sha256}, received ${digest}`
  )
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "crucible-hub-openapi-"))
const temporaryOutput = join(temporaryDirectory, "crucible-api.ts")
execFileSync(
  "node_modules/.bin/openapi-typescript",
  [contractPath, "-o", temporaryOutput],
  {
    stdio: "inherit",
  }
)

if (
  readFileSync(temporaryOutput, "utf8") !== readFileSync(generatedPath, "utf8")
) {
  throw new Error(
    "Generated OpenAPI types are stale. Run npm run api:generate."
  )
}
