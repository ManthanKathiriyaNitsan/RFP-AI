#!/usr/bin/env node
/**
 * Build for Vercel using the Build Output API v3.
 * Produces .vercel/output/ with:
 * - static/ = Vite build (index.html, assets)
 * - functions/server.func/ = Express app (run as serverless, not served as static)
 * - config.json = routes: filesystem first, then fallback to server
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// 1. Run vite build and esbuild (same as npm run build, but we don't copy to public/)
import { execSync } from "child_process";
execSync("npx vite build", { cwd: root, stdio: "inherit" });

// Ensure favicon is in static output (client/public/ may be gitignored so not in Vercel clone)
const faviconSrc = join(root, "client", "src", "assets", "icons8-ai-94.png");
const distPublic = join(root, "dist", "public");
if (existsSync(faviconSrc)) {
  mkdirSync(distPublic, { recursive: true });
  cpSync(faviconSrc, join(distPublic, "favicon.png"));
}
execSync(
  "npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  { cwd: root, stdio: "inherit" }
);

const out = join(root, ".vercel", "output");
rmSync(out, { recursive: true, force: true });

// 2. Static: copy dist/public to .vercel/output/static
const staticDir = join(out, "static");
mkdirSync(staticDir, { recursive: true });
cpSync(join(root, "dist", "public"), staticDir, { recursive: true });

// 3. Serverless function: copy dist/index.js to .vercel/output/functions/server.func/
const funcDir = join(out, "functions", "server.func");
mkdirSync(funcDir, { recursive: true });
cpSync(join(root, "dist", "index.js"), join(funcDir, "index.js"));

writeFileSync(
  join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.js",
      launcherType: "Nodejs",
    },
    null,
    2
  )
);

// 4. config.json: serve static first, then /api/* to server function, then SPA fallback to index.html
writeFileSync(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/api/(.*)", dest: "/server" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2
  )
);

console.log("Vercel build output written to .vercel/output");
