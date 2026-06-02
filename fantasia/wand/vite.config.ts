import { defineConfig } from "vite";
import pkg from "./package.json";

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: mode !== "development",
    sourcemap: mode === "development",
    rollupOptions: {
      input: {
        content: "src/content/index.ts",
        background: "src/background/index.ts",
      },
      output: {
        dir: "dist",
        format: "es",
        entryFileNames: "[name].js",
      },
    },
  },
}));
