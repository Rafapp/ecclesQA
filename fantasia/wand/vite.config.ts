import { defineConfig } from "vite";
import type { OutputBundle, OutputChunk } from "rollup";
import pkg from "./package.json";

const EXTENSION_ENTRY_FILES = ["background.js", "content.js", "popup.js"];

function assertClassicExtensionEntries(bundle: OutputBundle): void {
  for (const fileName of EXTENSION_ENTRY_FILES) {
    const output = bundle[fileName];
    if (!output || output.type !== "chunk") {
      throw new Error(`Missing extension entry bundle: ${fileName}`);
    }

    const chunk = output as OutputChunk;
    if (chunk.imports.length || chunk.dynamicImports.length || /^\s*(?:import(?:\s|["'{*])|export\s)/m.test(chunk.code)) {
      throw new Error(`${fileName} must be a self-contained classic script for Chrome Manifest V3.`);
    }
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: "validate-classic-extension-entries",
      generateBundle(_options, bundle) {
        assertClassicExtensionEntries(bundle);
      },
    },
  ],
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
        popup: "src/popup/index.ts",
      },
      output: {
        dir: "dist",
        format: "es",
        entryFileNames: "[name].js",
      },
    },
  },
}));
