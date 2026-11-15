import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
