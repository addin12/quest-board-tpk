import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // P2-16: every visible word goes through t() so both languages stay complete. Bare JSX text
  // is an error; punctuation, symbols and brand names are allowed. Props are not checked.
  {
    files: ["src/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", {
        noStrings: false,
        ignoreProps: true,
        allowedStrings: ["·", "—", "–", "/", "|", "(", ")", "+", "-", ":", "×", "…", "*", "→", "&", "Rp", "GM", "Quest Board", "WhatsApp", "Discord", "TPK", "The Pandemonium Kollektive", "English", "Bahasa Indonesia",
          ".", "#", "“", "”", "· GM", "ref:", "20", "Uicons by Flaticon"],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "src/generated/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
