import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      "node_modules/**",
      ".next/**",
      "api/node_modules/**",
      "api/dist/**",
      "out/**",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
