// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Bind the dev server to all interfaces so phones on the same WiFi can reach
// the host machine's LAN IP (otherwise the lovable plugin's sandbox detection
// may pick a host-only adapter like 192.168.56.x that the phone can't route to).
export default defineConfig({
  cloudflare: false,
  plugins: [nitro()],
  vite: {
    server: {
      host: "0.0.0.0",
    },
  },
});
