const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const isTauri = process.env.TAURI === "1";

module.exports = withPWA({
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1", "172.20.10.2"],
  ...(isTauri
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
});
