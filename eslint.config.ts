import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "**/.expo/**", "**/coverage/**"],
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        process: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
);
