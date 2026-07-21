import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "data/**", "dist/**", "build/**"],
  },
  ...nextConfig,
  {
    rules: {
      "react/jsx-no-target-blank": "error",
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // react-hooks v6 rules are too strict for generated shadcn code
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
];

export default config;
