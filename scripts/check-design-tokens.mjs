import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative } from "node:path"
import ts from "typescript"

const sourceRoot = "src"
function motionModuleOrTest(localPath) {
  return localPath === "lib/motion.ts" || /\.test\.tsx?$/.test(localPath)
}

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
      /(?:^|[\s"'`])(?:\S*:)?(?:(?:duration|delay)-\d+|ease-(?:linear|in|out|in-out))(?=[\s"'`]|$)/m,
  },
  {
    label:
      "primitive motion value (use a motion role from src/lib/motion.ts or var(--motion-*))",
    expression:
      /(?:cubic-bezier\(|(?:duration|delay|ease|animate)-\[|\[[^\]\s]*\d(?:ms|s)\b[^\]\s]*\]|(?:^|[\s"'`:])ease-(?:in|out|linear)\b|(?:transition|animation)[A-Za-z]*:\s*["'`][^"'`]*\d(?:ms|s)\b)/m,
    exempt: motionModuleOrTest,
  },
  {
    label:
      "primitive keyframe motion (use a motion role or enterMotionClassName from src/lib/motion.ts)",
    expression:
      /(?:^|[\s"'`:])(?:animate-(?:in|out)|(?:fade|zoom)-(?:in|out)(?:-\d+)?|slide-(?:in|out)-from-[a-z]+(?:-\d+)?)(?=[\s"'`]|$)/m,
    exempt: motionModuleOrTest,
  },
  {
    label: "primitive layer (use z-(--layer-*) from src/styles.css)",
    expression: /(?:^|[\s"'`:])-?z-(?:\d+|\[)|\[z-index:|zIndex:\s*\d/m,
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

const tableCellTags = new Set(["TableHead", "TableCell", "SortableTableHead"])
const tableAlignmentUtility =
  /^(?:[a-z0-9-]+:)*(?:text-(?:left|right|center|start|end)|tabular-nums)$/

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

const selfHidingIcons = new Set([
  "DelayedPendingIcon",
  "FacetFieldIcon",
  "PendingIcon",
  "PrincipalTypeIcon",
  "ResourceTypeIcon",
  "SummaryFieldIcon",
])

const iconOnlyButtonSizes = new Set([
  "icon",
  "icon-circle",
  "icon-lg",
  "icon-sm",
  "icon-xs",
  "pill-dismiss",
  "table-action",
])

const singleTruthIcons = [
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/editable-card-actions.tsx",
    ]),
    icons: ["CancelChangesIcon", "EditResourceIcon"],
    message:
      "composes editable card actions instead of using EditableCardActions or EditableCardTrigger",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/resource-full-page-link.tsx",
    ]),
    icons: ["OpenFullPageIcon"],
    message: "composes full-page link instead of using ResourceFullPageLink",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/card-view-all-link.tsx",
    ]),
    icons: ["ForwardNavigationIcon"],
    message: "composes card footer link instead of using CardViewAllLink",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/app-shell.tsx",
      "components/crucible/create-menu.tsx",
      "components/crucible/resource-creation-actions.tsx",
    ]),
    icons: ["CreateResourceIcon"],
    message:
      "composes creation action instead of using ResourceCreationActions or ResourceCreationLink",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/management-toggle.tsx",
    ]),
    icons: ["FinishManagingIcon", "ManageIcon"],
    message: "composes management toggle instead of using ManagementToggle",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/api-credential-card.tsx",
    ]),
    icons: ["RotateCredentialIcon"],
    message:
      "composes credential rotation trigger instead of using RotateCredentialAction",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/access-grant-row.tsx",
    ]),
    icons: ["AddAccessGrantIcon", "AddMemberIcon"],
    message:
      "composes access grant list actions instead of using AccessGrantListActions",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/resource-relationships.tsx",
    ]),
    icons: ["UnlinkRelationshipIcon"],
    message:
      "composes relationship unlink action instead of using UnlinkRelationshipAction",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "components/crucible/summary-field-icon.tsx",
    ]),
    icons: [
      "DataFormatFieldIcon",
      "DataTypeFieldIcon",
      "MeasurementFieldIcon",
      "SessionFieldIcon",
    ],
    message: "composes field icon instead of using SummaryFieldIcon",
  },
  {
    allowed: new Set([
      "components/crucible/icons.ts",
      "features/resource-graph/resource-graph-link.tsx",
      "features/resource-graph/resource-graph-page.tsx",
      "routes/fixtures.design-system.tsx",
    ]),
    icons: ["ResourceGraphIcon"],
    message:
      "composes graph navigation link instead of using ResourceGraphLink",
  },
]

function getJsxAttribute(opening, name) {
  return opening.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name
  )
}

function getJsxAttributeString(opening, name) {
  const attribute = getJsxAttribute(opening, name)
  if (!attribute?.initializer) return undefined
  if (ts.isStringLiteral(attribute.initializer))
    return attribute.initializer.text
  return undefined
}

function getButtonSize(opening) {
  if (getJsxAttribute(opening, "size")?.initializer) {
    return getJsxAttributeString(opening, "size") ?? "computed"
  }
  return "default"
}

function hasTextContent(node) {
  return (
    ts.isJsxElement(node) &&
    node.children.some(
      (child) => ts.isJsxText(child) && child.getText().trim() !== ""
    )
  )
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

  function buttonVariantsSize(opening) {
    const className = getJsxAttribute(opening, "className")
    if (
      !className?.initializer ||
      !ts.isJsxExpression(className.initializer) ||
      !className.initializer.expression
    )
      return undefined
    const expr = className.initializer.expression
    if (
      !ts.isCallExpression(expr) ||
      expr.expression.getText(source) !== "buttonVariants"
    )
      return undefined
    const arg = expr.arguments[0]
    if (!arg || !ts.isObjectLiteralExpression(arg)) return "default"
    const sizeProp = arg.properties.find(
      (prop) =>
        ts.isPropertyAssignment(prop) && prop.name.getText(source) === "size"
    )
    if (
      sizeProp &&
      ts.isPropertyAssignment(sizeProp) &&
      ts.isStringLiteral(sizeProp.initializer)
    )
      return sizeProp.initializer.text
    return "default"
  }

  function inspectButtonIconChildren(node, size, elementLabel) {
    const isIconOnly =
      iconOnlyButtonSizes.has(size) ||
      (size === "computed" && !hasTextContent(node))
    const icons = []
    function collectIcons(children) {
      for (const child of children) {
        if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
          const opening = ts.isJsxElement(child) ? child.openingElement : child
          const tag = opening.tagName.getText(source)
          if (tag === "Icon" || tag.endsWith("Icon")) icons.push(opening)
        } else if (ts.isJsxExpression(child) && child.expression) {
          function visitExpr(expr) {
            if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr)) {
              const opening = ts.isJsxElement(expr) ? expr.openingElement : expr
              const tag = opening.tagName.getText(source)
              if (tag === "Icon" || tag.endsWith("Icon")) icons.push(opening)
            }
            ts.forEachChild(expr, visitExpr)
          }
          visitExpr(child.expression)
        }
      }
    }
    collectIcons(node.children)
    for (const icon of icons) {
      const tag = icon.tagName.getText(source)
      if (!isIconOnly && !getJsxAttribute(icon, "data-icon")) {
        violations.push(
          `${localPath}: ${tag} inside labeled ${elementLabel} must declare data-icon="inline-start" or "inline-end"`
        )
      }
      if (
        !selfHidingIcons.has(tag) &&
        getJsxAttributeString(icon, "aria-hidden") !== "true"
      ) {
        violations.push(
          `${localPath}: decorative ${tag} inside ${elementLabel} must set aria-hidden="true"`
        )
      }
    }
  }

  function renderButtonSize(opening) {
    const renderAttr = getJsxAttribute(opening, "render")
    if (
      !renderAttr?.initializer ||
      !ts.isJsxExpression(renderAttr.initializer) ||
      !renderAttr.initializer.expression
    )
      return undefined
    const expr = renderAttr.initializer.expression
    if (!ts.isJsxSelfClosingElement(expr) && !ts.isJsxElement(expr))
      return undefined
    const innerOpening = ts.isJsxElement(expr) ? expr.openingElement : expr
    if (innerOpening.tagName.getText(source) !== "Button") return undefined
    return getButtonSize(innerOpening)
  }

  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(source)
      if (tag === "Button") {
        const size = getButtonSize(node.openingElement)
        inspectButtonIconChildren(node, size, "Button")
      } else {
        const linkSize = buttonVariantsSize(node.openingElement)
        if (linkSize) {
          inspectButtonIconChildren(node, linkSize, `${tag} (buttonVariants)`)
        } else {
          const triggerSize = renderButtonSize(node.openingElement)
          if (triggerSize)
            inspectButtonIconChildren(
              node,
              triggerSize,
              `${tag} (render Button)`
            )
        }
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      if (tag === "button")
        violations.push(`${localPath}: raw button outside shared UI primitives`)
      if (tableCellTags.has(tag)) {
        const className = node.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) && property.name.text === "className"
        )
        const alignment = className?.initializer
          ? classNames(className.initializer).find((name) =>
              tableAlignmentUtility.test(name)
            )
          : undefined
        if (alignment)
          violations.push(
            `${localPath}: ${tag} className sets ${alignment}; use the kind prop`
          )
      }
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
          if (pattern.exempt?.(localPath)) continue
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
    for (const rule of singleTruthIcons) {
      if (
        !rule.allowed.has(localPath) &&
        rule.icons.some((icon) => content.includes(icon))
      ) {
        violations.push(`${localPath}: ${rule.message}`)
      }
    }
    if (extname(path) === ".tsx") scanButtonUsage(path, localPath, content)
    for (const pattern of patterns) {
      if (pattern.exempt?.(localPath)) continue
      if (pattern.expression.test(content))
        violations.push(`${localPath}: ${pattern.label}`)
    }
  }
}

scan(sourceRoot)
if (violations.length > 0)
  throw new Error(`Design-token violations:\n${violations.join("\n")}`)
