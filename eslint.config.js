import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", "src/integrations/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked.slice(0, 1), ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      sonarjs,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Unused vars: error on unused locals, warn on unused params (underscore prefix opts out)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { vars: "all", args: "after-used", ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Explicit any is an error; use eslint-disable-next-line with a comment for justified exceptions
      "@typescript-eslint/no-explicit-any": "error",
      // Prevent unintentional floating promises
      "@typescript-eslint/no-floating-promises": "off",
      // React hooks dependency arrays must be exhaustive
      "react-hooks/exhaustive-deps": "warn",
      // No loose equality
      "eqeqeq": ["error", "always", { null: "ignore" }],
      // No console.log in production code (use warn/error)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // ── SonarQube rules (sonarjs) ──────────────────────────────────
      // Bugs & vulnerabilities
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-element-overwrite": "error",
      "sonarjs/no-empty-collection": "error",
      "sonarjs/no-extra-arguments": "error",
      "sonarjs/no-identical-conditions": "error",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-ignored-return": "error",
      "sonarjs/no-use-of-empty-return-value": "error",
      "sonarjs/non-existent-operator": "error",
      "sonarjs/no-gratuitous-expressions": "error",
      "sonarjs/no-redundant-boolean": "error",
      // Security hotspots
      "sonarjs/no-hardcoded-passwords": "error",
      "sonarjs/no-hardcoded-secrets": "error",
      "sonarjs/pseudo-random": "warn",
      "sonarjs/insecure-cookie": "warn",
      "sonarjs/csrf": "warn",
      "sonarjs/sql-queries": "warn",
      "sonarjs/code-eval": "error",
      // Code smells / maintainability
      "sonarjs/cognitive-complexity": ["warn", 30],
      "sonarjs/no-collapsible-if": "warn",
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      "sonarjs/no-duplicated-branches": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-inverted-boolean-check": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/no-redundant-jump": "warn",
      "sonarjs/no-same-line-conditional": "warn",
      "sonarjs/no-small-switch": "warn",
      "sonarjs/no-unused-collection": "warn",
      "sonarjs/prefer-immediate-return": "warn",
      "sonarjs/prefer-single-boolean-return": "warn",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-dead-store": "warn",
      "sonarjs/no-commented-code": "warn",
    },
  },
  eslintPluginPrettier,
);
