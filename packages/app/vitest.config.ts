import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@vobs/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    css: false,
  },
});
