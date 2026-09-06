import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

const ignored = new Set([
  ".git",
  ".tanstack",
  ".output",
  "dist",
  "node_modules",
])
const violations = []
const patterns = [
  {
    label: "private key",
    expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  { label: "AWS access key", expression: /AKIA[0-9A-Z]{16}/ },
  { label: "GitHub token", expression: /gh[opsu]_[A-Za-z0-9]{36,}/ },
]

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      scan(path)
      continue
    }
    if (entry.name.endsWith(".ico")) continue
    const content = readFileSync(path, "utf8")
    for (const pattern of patterns) {
      if (pattern.expression.test(content))
        violations.push(`${relative(".", path)}: ${pattern.label}`)
    }
  }
}

scan(".")
if (violations.length > 0)
  throw new Error(`Potential secrets detected:\n${violations.join("\n")}`)
