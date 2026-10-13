import { execSync } from "node:child_process"
import { resolve, sep } from "node:path"
import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

function resolveGitCommit(): string {
  if (process.env.VITE_GIT_COMMIT) {
    return process.env.VITE_GIT_COMMIT
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return ""
  }
}

const sharedSourceRoots = ["components", "lib", "data"].map(
  (directory) => resolve("src", directory) + sep
)

const gitCommit = resolveGitCommit()
if (!process.env.VITE_GIT_COMMIT && gitCommit) {
  process.env.VITE_GIT_COMMIT = gitCommit
}

const config = defineConfig({
  base: "/hub/",
  define: {
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(gitCommit),
  },
  resolve: { tsconfigPaths: true },
  server: {
    allowedHosts: ["leviathan.rooster-chimaera.ts.net"],
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: "vendor",
                  test: /node_modules[\\/](?!(?:elkjs|@xyflow|qrcode\.react|@tanstack[\\/](?:react-form|form-core))[\\/])/,
                  minShareCount: 2,
                  priority: 2,
                },
                {
                  name: "shared",
                  test: (id) =>
                    sharedSourceRoots.some((root) => id.startsWith(root)),
                  minShareCount: 2,
                  priority: 1,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({ start: { entry: "start.ts" } }),
    nitro({
      baseURL: "/hub/",
      compressPublicAssets: { gzip: true, brotli: true },
    }),
    viteReact(),
  ],
})

export default config
