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
const anchorCache = new Map()

function githubSlug(heading) {
  return heading
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-")
}

function anchorsOf(path) {
  if (!anchorCache.has(path)) {
    const seen = new Map()
    const anchors = new Set()
    let fenced = false
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
      const heading = !fenced && /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
      if (!heading) continue
      const slug = githubSlug(heading[1])
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      anchors.add(count === 0 ? slug : `${slug}-${count}`)
    }
    anchorCache.set(path, anchors)
  }
  return anchorCache.get(path)
}

for (const file of markdownFiles(process.cwd())) {
  const contents = readFileSync(file, "utf8")

  for (const match of contents.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "")
    const [target, anchor] = rawTarget.split("#", 2)

    if (target.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(target)) {
      continue
    }

    const resolvedTarget = target
      ? resolve(dirname(file), decodeURIComponent(target))
      : file
    if (!existsSync(resolvedTarget) || !statSync(resolvedTarget)) {
      failures.push(`${file}: ${rawTarget}`)
    } else if (
      anchor &&
      extname(resolvedTarget) === ".md" &&
      !anchorsOf(resolvedTarget).has(decodeURIComponent(anchor).toLowerCase())
    ) {
      failures.push(`${file}: ${rawTarget} (missing heading)`)
    }
  }
}

if (failures.length > 0) {
  console.error(
    `Missing local Markdown targets or headings:\n${failures.join("\n")}`
  )
  process.exitCode = 1
}
