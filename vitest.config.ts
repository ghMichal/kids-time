import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "./src"),
          },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "./src"),
          },
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          passWithNoTests: true,
        },
      },
    ],
  },
});
