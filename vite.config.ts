import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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

function assertDistManifestOptionalPermissions(distManifestPath: string): void {
  const source = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8")) as {
    optional_permissions?: string[];
    optional_host_permissions?: string[];
  };
  const dist = JSON.parse(readFileSync(distManifestPath, "utf8")) as {
    optional_permissions?: string[];
    optional_host_permissions?: string[];
  };
  if (JSON.stringify(dist.optional_permissions) !== JSON.stringify(source.optional_permissions)) {
    throw new Error("dist/manifest.json optional_permissions drifted from source manifest.json");
  }
  if (JSON.stringify(dist.optional_host_permissions) !== JSON.stringify(source.optional_host_permissions)) {
    throw new Error("dist/manifest.json optional_host_permissions drifted from source manifest.json");
  }
  const hosts = dist.optional_host_permissions ?? [];
  for (const required of ["<all_urls>", "http://*/*", "https://*/*"]) {
    if (!hosts.includes(required)) {
      throw new Error(`dist/manifest.json optional_host_permissions missing ${required}`);
    }
  }
  if (!(dist.optional_permissions ?? []).includes("tabs")) {
    throw new Error("dist/manifest.json optional_permissions missing tabs");
  }
}

function copyExtensionFiles(): Plugin {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const dist = resolve(projectRoot, "dist");
      mkdirSync(dist, { recursive: true });
      const distManifest = resolve(dist, "manifest.json");
      cpSync(resolve(projectRoot, "manifest.json"), distManifest);
      cpSync(resolve(projectRoot, "icons"), resolve(dist, "icons"), { recursive: true });
      for (const required of ["settings.html", "index.html", "add.html", "background.js", "manifest.json"]) {
        if (!existsSync(resolve(dist, required))) {
          throw new Error(`Extension build missing required dist/${required}`);
        }
      }
      assertDistManifestOptionalPermissions(distManifest);
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
        settings: resolve(projectRoot, "src/settings.html"),
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
