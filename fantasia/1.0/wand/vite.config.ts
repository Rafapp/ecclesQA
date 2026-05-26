import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: "src/content/index.ts",
        background: "src/background/index.ts"
      }
    }
  }
});
