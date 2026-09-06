import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"

const ignoredDirectories = new Set([
  ".git",
  ".output",
  ".playwright-cli",
  "dist",
  "node_modules",
  "output",
  "test-results",
])

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return []

    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return extname(entry.name) === ".md" ? [path] : []
  })
}

const failures = []
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g

for (const file of markdownFiles(process.cwd())) {
  const contents = readFileSync(file, "utf8")

  for (const match of contents.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "")
    const target = rawTarget.split("#", 1)[0]

    if (
      !target ||
      target.startsWith("/") ||
      /^[a-z][a-z\d+.-]*:/i.test(target)
    ) {
      continue
    }

    const decodedTarget = decodeURIComponent(target)
    const resolvedTarget = resolve(dirname(file), decodedTarget)
    if (!existsSync(resolvedTarget) || !statSync(resolvedTarget)) {
      failures.push(`${file}: ${rawTarget}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`Missing local Markdown targets:\n${failures.join("\n")}`)
  process.exitCode = 1
}
