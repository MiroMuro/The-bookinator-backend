import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import { fixupConfigRules } from "@eslint/compat";
export default [
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  { ignores: ["dist/**", "src/utils/codegen/**"] },
  {
    files: ["**/*.js"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: { sourceType: "commonjs" },
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  ...fixupConfigRules(pluginReactConfig),
  {},
];
