// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    // The zero-config default for this wrapper is `cloudflare-module`
    // (Cloudflare Workers), which Vercel's build system cannot run as a
    // Vercel serverless function. Since this project deploys to Vercel,
    // the preset must be set explicitly — see:
    // node_modules/@lovable.dev/vite-tanstack-config/dist/index.js, the
    // `defaultPreset: "cloudflare-module"` line.
    preset: "vercel",
    // NOTE: the punycode/unenv workaround that used to live here (see git
    // history) is no longer needed on this preset. It existed only because
    // Cloudflare Workers builds go through unenv's Node-compatibility
    // polyfill layer, where tr46's `require("punycode/")` couldn't resolve.
    // Vercel's preset targets real Node.js, so that polyfill layer isn't
    // in the picture and the native `punycode` package resolves normally.
  } as { preset?: string; unenv?: unknown[] },
});
