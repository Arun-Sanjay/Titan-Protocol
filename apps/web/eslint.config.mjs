import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [".next/**", "out/**", "next.config.js", "public/sw.js", "public/workbox-*.js", "src-tauri/**"],
  },
];

export default config;
