import { build } from "vite"

let failure

try {
  await build({
    configFile: "tests/build/vite.import-protection.config.ts",
    logLevel: "silent",
  })
} catch (error) {
  failure = error
}

const output = failure instanceof Error ? failure.stack : String(failure)
const expectedEvidence = [
  "[import-protection] Import denied in client environment",
  "tests/build/import-server-only.client.ts",
  "src/server/crucible/client.server.ts",
]

if (!failure) {
  throw new Error("Server-only import probe unexpectedly built for the client")
}

for (const evidence of expectedEvidence) {
  if (!output.includes(evidence)) {
    throw new Error(
      `Server-only import probe failed without expected evidence: ${evidence}`
    )
  }
}

console.log("Server-only browser import was rejected by TanStack Start")
