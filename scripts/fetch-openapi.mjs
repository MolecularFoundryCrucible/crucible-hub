import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const repository = "MolecularFoundryCrucible/crucible-api"
const contractPath = "contracts/crucible-api.json"
const lockPath = "contracts/crucible-api.lock.json"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function gh(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim()
}

const tag = process.argv[2]
const release = /^v(\d+\.\d+\.\d+)$/.exec(tag ?? "")?.[1]
if (!release) fail("Usage: npm run api:fetch -- vX.Y.Z")

const folder = mkdtempSync(join(tmpdir(), "crucible-api-contract-"))
try {
  try {
    gh([
      "release",
      "download",
      tag,
      "--repo",
      repository,
      "--pattern",
      "crucible-api.json",
      "--pattern",
      "crucible-api.json.sha256",
      "--dir",
      folder,
    ])
  } catch {
    fail(`${tag} has no crucible-api.json release asset to download.`)
  }
  const contract = readFileSync(join(folder, "crucible-api.json"))
  // The checksum file names the repository path, so compare only the digest.
  const expected = readFileSync(
    join(folder, "crucible-api.json.sha256"),
    "utf8"
  )
    .trim()
    .split(/\s+/)[0]
  const digest = createHash("sha256").update(contract).digest("hex")
  if (digest !== expected) {
    fail(`Checksum mismatch for ${tag}: expected ${expected}, got ${digest}`)
  }
  const version = JSON.parse(contract.toString("utf8")).info?.version
  if (version !== release) {
    fail(`The ${tag} contract reports version ${version}`)
  }
  const revision = gh([
    "api",
    `repos/${repository}/commits/${tag}`,
    "--jq",
    ".sha",
  ])
  const committedAt = gh([
    "api",
    `repos/${repository}/commits/${tag}`,
    "--jq",
    ".commit.committer.date",
  ])

  writeFileSync(contractPath, contract)
  writeFileSync(
    lockPath,
    `${JSON.stringify(
      {
        sourceRepository: "crucible-api",
        sourceRelease: tag,
        sourceAsset: "crucible-api.json",
        sourceRevision: revision,
        minimumRelease: release,
        sha256: digest,
        openapi: JSON.parse(contract.toString("utf8")).openapi,
        generatedAt: new Date(committedAt).toISOString(),
      },
      null,
      2
    )}\n`
  )
  execFileSync("npm", ["run", "--silent", "api:generate"], {
    stdio: "inherit",
  })
  console.log(`Pinned crucible-api ${tag} (${revision.slice(0, 7)}).`)
} finally {
  rmSync(folder, { force: true, recursive: true })
}
