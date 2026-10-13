import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative } from "node:path"
import ts from "typescript"

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
  {
    label: "primitive motion",
    expression:
      /(?:^|[\s"'`])(?:\S*:)?(?:duration-\d+|ease-(?:linear|in|out|in-out))(?=[\s"'`]|$)/m,
  },
]

const themeSource = readFileSync(join(sourceRoot, "styles.css"), "utf8")
const knownTextUtilities = new Set([
  ...[...themeSource.matchAll(/--text-([a-z0-9-]+):/g)]
    .map(([, name]) => name)
    .filter((name) => !name.includes("--")),
  ...[...themeSource.matchAll(/--color-([a-z0-9-]+):/g)].map(
    ([, name]) => name
  ),
  "balance",
  "center",
  "clip",
  "current",
  "ellipsis",
  "end",
  "inherit",
  "justify",
  "left",
  "nowrap",
  "pretty",
  "right",
  "start",
  "transparent",
  "wrap",
])

function unknownTextUtilities(content) {
  return [
    ...content.matchAll(
      /(?:^|[\s"'`:])text-([a-z][a-z0-9-]*)(?:\/\d+)?(?=[\s"'`]|$)/gm
    ),
  ]
    .map(([, name]) => name)
    .filter((name) => !knownTextUtilities.has(name))
}

const primitivePatterns = patterns.filter(({ label }) =>
  label.startsWith("primitive ")
)

const buttonStyleUtility =
  /^(?:bg|border(?:-[trblxy])?|font|gap(?:-[xy])?|h|max-h|min-h|p[trblxy]?|ring|rounded|shadow|size|tracking|whitespace)(?:-|$)/

function classNames(node) {
  const values = []
  function visit(current) {
    if (
      ts.isStringLiteral(current) ||
      ts.isNoSubstitutionTemplateLiteral(current)
    )
      values.push(current.text)
    ts.forEachChild(current, visit)
  }
  visit(node)
  return values.flatMap((value) => value.split(/\s+/).filter(Boolean))
}

function unmodifiedUtility(className) {
  const utility = className.slice(className.lastIndexOf(":") + 1)
  if (buttonStyleUtility.test(utility)) return utility
  if (
    utility.startsWith("text-") &&
    !/^text-(?:center|end|left|right|start)$/.test(utility)
  )
    return utility
  return undefined
}

function scanButtonUsage(path, localPath, content) {
  if (localPath.endsWith(".test.tsx")) return
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  function inspectClasses(node, label) {
    const utility = classNames(node).map(unmodifiedUtility).find(Boolean)
    if (utility) violations.push(`${localPath}: ${label} overrides ${utility}`)
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      if (tag === "button")
        violations.push(`${localPath}: raw button outside shared UI primitives`)
      if (tag === "Button") {
        const className = node.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) && property.name.text === "className"
        )
        if (className?.initializer)
          inspectClasses(className.initializer, "Button className")
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "buttonVariants"
    ) {
      for (const argument of node.arguments) {
        if (!ts.isObjectLiteralExpression(argument)) continue
        const className = argument.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(source) === "className"
        )
        if (className && ts.isPropertyAssignment(className))
          inspectClasses(className.initializer, "buttonVariants className")
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
}

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      scan(path)
      continue
    }
    if (!new Set([".ts", ".tsx"]).has(extname(path))) continue
    const localPath = relative(sourceRoot, path)
    if (!localPath.startsWith("generated/")) {
      for (const name of unknownTextUtilities(readFileSync(path, "utf8"))) {
        violations.push(`${localPath}: unknown text utility text-${name}`)
      }
    }
    if (allowedPrefixes.some((prefix) => localPath.startsWith(prefix))) {
      if (localPath.startsWith("components/ui/")) {
        const primitive = readFileSync(path, "utf8")
        for (const pattern of primitivePatterns) {
          if (pattern.expression.test(primitive))
            violations.push(`${localPath}: ${pattern.label}`)
        }
      }
      continue
    }
    const content = readFileSync(path, "utf8")
    if (
      localPath !== "components/crucible/icons.ts" &&
      /from ["']lucide-react["']/.test(content)
    ) {
      violations.push(
        `${localPath}: imports Lucide directly instead of using the semantic icon catalog`
      )
    }
    if (
      localPath.startsWith("features/") &&
      content.includes('from "@/components/ui/alert-dialog"')
    ) {
      violations.push(
        `${localPath}: feature imports alert dialog instead of shared confirmation dialog`
      )
    }
    if (
      localPath !== "components/crucible/identity-hover-card.tsx" &&
      content.includes('from "@/components/ui/hover-card"')
    ) {
      violations.push(
        `${localPath}: imports hover-card primitives instead of using IdentityHoverCard`
      )
    }
    if (content.includes("rounded-none bg-transparent ring-0")) {
      violations.push(
        `${localPath}: strips shared component styling instead of using an explicit presentation`
      )
    }
    if (
      localPath !== "components/crucible/mfid-text.tsx" &&
      !localPath.startsWith("routes/fixtures.") &&
      content.includes("font-mono text-identifier")
    ) {
      violations.push(
        `${localPath}: composes MFID typography instead of using MfidText`
      )
    }
    if (
      localPath.startsWith("features/") &&
      content.includes("CancelChangesIcon")
    ) {
      violations.push(
        `${localPath}: composes editable card actions instead of using EditableCardActions`
      )
    }
    if (extname(path) === ".tsx") scanButtonUsage(path, localPath, content)
    for (const pattern of patterns) {
      if (pattern.expression.test(content))
        violations.push(`${localPath}: ${pattern.label}`)
    }
  }
}

scan(sourceRoot)
if (violations.length > 0)
  throw new Error(`Design-token violations:\n${violations.join("\n")}`)
