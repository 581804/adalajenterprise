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
    // The @lovable.dev/vite-tanstack-config types don't yet declare `unenv`
    // on the nitro option, but Nitro's runtime config accepts it (confirmed:
    // `npm run build` succeeds using this exact field). Cast narrowly here
    // rather than suppressing the whole nitro block, so a real type error
    // elsewhere in this config would still surface.
    unenv: [
      {
        // Works around a server-build failure on the cloudflare-module
        // target: tr46 (a transitive dep of mongoose -> mongodb ->
        // mongodb-connection-string-url -> whatwg-url -> tr46) does
        // `require("punycode/")` with a trailing slash — a deliberate
        // directory-style import that asks for the real "punycode" npm
        // package (not Node's deprecated built-in module of the same
        // name). unenv's Node-compat layer doesn't know how to resolve
        // that trailing-slash specifier, so point it at the actual
        // installed package directly. This must go through Nitro's
        // `unenv` option (not Vite's top-level `resolve.alias`) because
        // Nitro's server environment builds with its own separate
        // resolve config that doesn't inherit the outer one.
        meta: { name: "punycode-directory-import-fix" },
        alias: { "punycode/": "punycode" },
      },
    ],
  } as { preset?: string; unenv?: unknown[] },
});
