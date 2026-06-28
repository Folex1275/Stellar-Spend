// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import storybook from "eslint-plugin-storybook";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const reactPlugin = require("eslint-plugin-react");
const nextPlugin = require("@next/eslint-plugin-next");

export default [
  {
    ignores: [".next/**", "node_modules/**", "public/sw.js"],
  },
  {
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@typescript-eslint": tsPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
      next: {
        rootDir: resolve(__dirname),
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat["jsx-runtime"].rules,
      ...reactHooksPlugin.configs["recommended-latest"].rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/no-unknown-property": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "warn",
      "no-console": "error",
    },
  },
  // Module boundary enforcement: app/components/hooks must use barrel imports
  {
    files: [
      "src/app/**/*.{js,jsx,ts,tsx}",
      "src/components/**/*.{js,jsx,ts,tsx}",
      "src/hooks/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/services/*"], message: "Import from '@/lib/services' instead of deep importing." },
            { group: ["@/lib/clients/*"], message: "Import from '@/lib/clients' instead of deep importing." },
            { group: ["@/lib/wallets/*"], message: "Import from '@/lib/wallets' instead of deep importing." },
            { group: ["@/lib/repositories/*"], message: "Import from '@/lib/repositories' instead of deep importing." },
            { group: ["@/lib/validators/*"], message: "Import from '@/lib/validators' instead of deep importing." },
            { group: ["@/lib/middleware/*"], message: "Import from '@/lib/middleware' instead of deep importing." },
            { group: ["@/lib/notifications/*"], message: "Import from '@/lib/notifications' instead of deep importing." },
            { group: ["@/lib/webhook/*"], message: "Import from '@/lib/webhook' instead of deep importing." },
            { group: ["@/lib/cache/*"], message: "Import from '@/lib/cache' instead of deep importing." },
            { group: ["@/lib/events/*"], message: "Import from '@/lib/events' instead of deep importing." },
            { group: ["@/lib/security/*"], message: "Import from '@/lib/security' instead of deep importing." },
            { group: ["@/lib/errors/*"], message: "Import from '@/lib/errors' instead of deep importing." },
          ],
        },
      ],
    },
  },
];
