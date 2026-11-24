import { tanstackConfig } from "@tanstack/eslint-config"

const noFeatureImports = {
  group: ["@/features/**", "@/routes/**", "**/features/**", "**/routes/**"],
  message: "Shared code must not import features or routes.",
}

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    files: ["src/{components,hooks,lib,data,server}/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noFeatureImports] }],
    },
  },
  {
    files: ["src/{lib,data,server}/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noFeatureImports,
            {
              group: ["@/components/**", "@/hooks/**"],
              message: "Data, server, and lib code must not import UI.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "eslint.config.js",
      ".output/**",
      ".playwright-cli/**",
      ".prettierrc",
    ],
  },
]
