import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
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
