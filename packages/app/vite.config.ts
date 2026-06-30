import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The app consumes the engine straight from source (Vite compiles the TS), so there is no
// build step between engine and app and HMR works across the boundary. The engine package's
// own "main" still points at dist/ for Node + the test runner.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@vobs/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
});
