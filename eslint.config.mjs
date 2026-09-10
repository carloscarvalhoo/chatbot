import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/output/**",
  ]),
  {
    rules: {
      // Recomendação estilística do React 19 — o projeto usa "fetch no mount"
      // e "sincroniza prop→state" em vários hooks. Mantemos como aviso, não erro,
      // para não travar o `next build`.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
