import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a build-time guard: it exists to make Next's bundler
      // fail if a server module is pulled into a client bundle. There is no
      // bundler here, and its default export throws on import, so a server
      // component that imports one of these modules could not be rendered in a
      // test at all. Everything under test still runs in Node.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
});
