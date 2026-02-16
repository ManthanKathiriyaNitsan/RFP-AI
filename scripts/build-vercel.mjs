#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

execSync("npx vite build", { cwd: root, stdio: "inherit" });

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

const staticDir = join(out, "static");
mkdirSync(staticDir, { recursive: true });
cpSync(join(root, "dist", "public"), staticDir, { recursive: true });

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
