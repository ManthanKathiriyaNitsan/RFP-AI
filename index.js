// Vercel serverless entry: export Express app so it runs as a function (not served as static).
// Static assets are served from public/ by Vercel's CDN.
export { default } from "./dist/index.js";
