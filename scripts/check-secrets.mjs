import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const violations = []
const patterns = [
  {
    label: "private key",
    expression:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    label: "service account key",
    expression: /"private_key"\s*:\s*"-----BEGIN/,
  },
  { label: "AWS access key", expression: /AKIA[0-9A-Z]{16}/ },
  { label: "GitHub token", expression: /gh[opsu]_[A-Za-z0-9]{36,}/ },
  {
    label: "GitHub fine-grained token",
    expression: /github_pat_[A-Za-z0-9_]{60,}/,
  },
  { label: "Google API key", expression: /AIza[0-9A-Za-z_-]{35}/ },
  { label: "Google OAuth token", expression: /ya29\.[0-9A-Za-z_-]{20,}/ },
  { label: "Slack token", expression: /xox[abposr]-[0-9A-Za-z-]{10,}/ },
  {
    label: "credential assignment",
    expression:
      /^\s*(?:export\s+)?(?:CRUCIBLE_API_KEY|HUB_AUTH_CLIENT_SECRET|HUB_SESSION_KEYS|DATABASE_URL|HUB_DATABASE_PASSWORD)\s*=\s*["']?(?![<$])[^\s"'#]{8,}/m,
  },
]

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)

for (const path of files) {
  if (/\.(?:ico|png|jpe?g|webp|gif|woff2?)$/i.test(path)) continue
  let content
  try {
    content = readFileSync(path, "utf8")
  } catch {
    continue
  }
  for (const pattern of patterns) {
    if (pattern.expression.test(content))
      violations.push(`${path}: ${pattern.label}`)
  }
}

if (violations.length > 0)
  throw new Error(`Potential secrets detected:\n${violations.join("\n")}`)
