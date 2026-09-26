import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

function aliasNewTabPage(): Plugin {
  return {
    name: "alias-new-tab-page",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path, query] = (req.url ?? "").split("?");
        if (path === "/newtab.html") req.url = query ? `/index.html?${query}` : "/index.html";
        next();
      });
    },
  };
}

function copyExtensionFiles(): Plugin {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const dist = resolve(projectRoot, "dist");
      mkdirSync(dist, { recursive: true });
      cpSync(resolve(projectRoot, "manifest.json"), resolve(dist, "manifest.json"));
      cpSync(resolve(projectRoot, "icons"), resolve(dist, "icons"), { recursive: true });
    },
  };
}

export default defineConfig({
  root: resolve(projectRoot, "src"),
  base: "./",
  publicDir: false,
  build: {
    outDir: resolve(projectRoot, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    target: "chrome120",
    rollupOptions: {
      input: {
        main: resolve(projectRoot, "src/index.html"),
        add: resolve(projectRoot, "src/add.html"),
        background: resolve(projectRoot, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [aliasNewTabPage(), copyExtensionFiles()],
});
