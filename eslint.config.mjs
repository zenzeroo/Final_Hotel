import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A leading underscore marks a value as intentionally unused
  // (`const { id: _id, ...patch } = args`, `_locale` placeholders).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Live-DB tooling (run with npx tsx) — excluded from tsconfig too.
    "scripts/**",
    // Claude Code worktrees: full copies of the repo — linting them from the
    // main checkout reports every file twice (and their own .next output).
    ".claude/**",
  ]),
]);

export default eslintConfig;
