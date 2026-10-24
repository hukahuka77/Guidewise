import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Signed photo links must not depend on whichever server key the build machine has
    env: { PHOTO_SIGNING_SECRET: "test-photo-signing-secret" },
  },
});
