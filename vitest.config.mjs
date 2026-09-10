import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${fileURLToPath(new URL("./src/", import.meta.url))}` },
      // `server-only` só existe no bundler do Next; stub para os testes.
      {
        find: "server-only",
        replacement: fileURLToPath(new URL("./test/stubs/empty.js", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["test/**/*.test.js"],
    environment: "node",
  },
});
