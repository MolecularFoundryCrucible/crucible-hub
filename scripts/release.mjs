import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim()
}

const rawArgs = process.argv.slice(2)
let dryRun = false
let push = false
let bumpArg

for (const arg of rawArgs) {
  if (arg === "--dry-run") {
    dryRun = true
  } else if (arg === "--push") {
    push = true
  } else if (!arg.startsWith("-") && !bumpArg) {
    bumpArg = arg
  } else {
    fail(
      `Usage: npm run release -- [patch|minor|major|X.Y.Z] [--dry-run] [--push]`
    )
  }
}

const target = bumpArg ?? "patch"
const changelogPath = "CHANGELOG.md"
const changelog = readFileSync(changelogPath, "utf8")

const unreleasedMatch =
  /^## Unreleased\n([\s\S]*?)(?=^## \d+\.\d+\.\d+\b)/m.exec(changelog)
if (!unreleasedMatch) {
  fail(
    "CHANGELOG.md is missing an Unreleased section above the latest release."
  )
}

const unreleasedBody = unreleasedMatch[1].trim()
if (!unreleasedBody || !/^-\s+/m.test(unreleasedBody)) {
  fail("CHANGELOG.md has no bullet entries under ## Unreleased.")
}

const latestReleaseMatch = /^## (\d+)\.(\d+)\.(\d+)\b/m.exec(changelog)
if (!latestReleaseMatch) {
  fail("Could not find a previous release heading in CHANGELOG.md.")
}

const major = Number(latestReleaseMatch[1])
const minor = Number(latestReleaseMatch[2])
const patch = Number(latestReleaseMatch[3])

let nextVersion
if (target === "patch") {
  nextVersion = `${major}.${minor}.${patch + 1}`
} else if (target === "minor") {
  nextVersion = `${major}.${minor + 1}.0`
} else if (target === "major") {
  nextVersion = `${major + 1}.0.0`
} else if (/^\d+\.\d+\.\d+$/.test(target)) {
  nextVersion = target
} else {
  fail(
    `Invalid version target "${target}". Expected patch, minor, major, or X.Y.Z.`
  )
}

const tag = `v${nextVersion}`
try {
  git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`])
  fail(`Git tag ${tag} already exists.`)
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 0
  ) {
    fail(`Git tag ${tag} already exists.`)
  }
}

const now = new Date()
const date = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-")

if (dryRun) {
  console.log(`Dry run: ${tag} (${date})\n\n${unreleasedBody}`)
  process.exit(0)
}

const dirtyLines = git(["status", "--porcelain"])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
const unrelatedDirty = dirtyLines.filter(
  (line) => !line.endsWith(` ${changelogPath}`) && line !== `M ${changelogPath}`
)
if (unrelatedDirty.length > 0) {
  fail(
    `Commit or stash changes outside ${changelogPath} before cutting a release:\n${unrelatedDirty.join("\n")}`
  )
}

const nextChangelog = changelog.replace(
  /^## Unreleased\n([\s\S]*?)(?=^## \d+\.\d+\.\d+\b)/m,
  `## Unreleased\n\n## ${nextVersion} - ${date}\n\n${unreleasedBody}\n\n`
)

writeFileSync(changelogPath, nextChangelog, "utf8")
git(["add", changelogPath])
git(["commit", "-m", `chore(release): ${nextVersion}`])
git(["tag", "-a", tag, "-m", `Crucible Hub ${nextVersion}`])

if (push) {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"])
  execFileSync("git", ["push", "origin", branch, tag], { stdio: "inherit" })
} else {
  console.log(`Prepared ${tag}. Push with: git push origin HEAD ${tag}`)
}
