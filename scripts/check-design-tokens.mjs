import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative } from "node:path"

const sourceRoot = "src"
const allowedPrefixes = ["components/ui/", "generated/"]
const violations = []
const patterns = [
  {
    label: "raw color",
    expression: /(?:#[0-9a-f]{3,8}|\b(?:rgb|hsl|oklch)\()/i,
  },
  { label: "inline style", expression: /style=\{\{/ },
  {
    label: "arbitrary utility value",
    expression: /(?:^|\s)[a-z-]+-\[[^\]]+\]/,
  },
  {
    label: "primitive typography size",
    expression:
      /(?:^|[\s"'`])(?:[a-z][a-z0-9-]*:)*text-(?:xs|sm|base|lg|xl|[2-9]xl)\b/m,
  },
  {
    label: "primitive typography weight",
    expression:
      /(?:^|[\s"'`])(?:[a-z][a-z0-9-]*:)*font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/m,
  },
  {
    label: "primitive typography line height",
    expression:
      /(?:^|[\s"'`])(?:[a-z][a-z0-9-]*:)*leading-(?:none|tight|snug|normal|relaxed|loose|[3-9]|10)\b/m,
  },
  {
    label: "primitive typography tracking",
    expression:
      /(?:^|[\s"'`])(?:[a-z][a-z0-9-]*:)*tracking-(?:tighter|tight|normal|wide|wider|widest)\b/m,
  },
]

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      scan(path)
      continue
    }
    if (!new Set([".ts", ".tsx"]).has(extname(path))) continue
    const localPath = relative(sourceRoot, path)
    if (allowedPrefixes.some((prefix) => localPath.startsWith(prefix))) continue
    const content = readFileSync(path, "utf8")
    for (const pattern of patterns) {
      if (pattern.expression.test(content))
        violations.push(`${localPath}: ${pattern.label}`)
    }
  }
}

scan(sourceRoot)
if (violations.length > 0)
  throw new Error(`Design-token violations:\n${violations.join("\n")}`)
