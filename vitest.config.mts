import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests import app modules the same way the app does ("@/lib/..."), so the tsconfig alias
  // has to exist here too.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "") },
  },
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
