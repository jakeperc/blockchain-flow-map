import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default defineConfig([
  globalIgnores(["dist-live/**", "outputs/**", "work/**", "node_modules/**", ".sites-runtime/**", ".next/**", ".vinext/**", ".wrangler/**", "worker/.wrangler/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      // These five files are vendored verbatim from shadcn. Keep the registry
      // source intact while applying the stricter rules to the project's own code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      // The verifiers are plain CommonJS on purpose: they load the modules
      // verify-all.mjs compiles to CommonJS in a scratch directory.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
