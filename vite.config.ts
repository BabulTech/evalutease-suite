// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { visualizer } from "rollup-plugin-visualizer";
import fs from "node:fs";
import path from "node:path";

function bundleAnalyzerPlugin() {
  return {
    name: "local-bundle-analyzer",
    apply: "build" as const,
    generateBundle(options: { dir?: string }, bundle: Record<string, any>) {
      if (process.env.ANALYZE !== "true") return;
      const outputDir = options.dir ? path.resolve(process.cwd(), options.dir) : "";
      if (!outputDir.includes(`${path.sep}.output${path.sep}public`)) return;

      const chunks = Object.entries(bundle)
        .filter(([, item]) => item.type === "chunk")
        .map(([fileName, item]) => {
          const modules = Object.entries(item.modules ?? {})
            .map(([id, mod]: [string, any]) => ({
              id: id.replace(process.cwd(), "").replaceAll("\\", "/"),
              bytes: mod.renderedLength ?? mod.originalLength ?? 0,
            }))
            .sort((a, b) => b.bytes - a.bytes);

          return {
            fileName,
            bytes: item.code?.length ?? 0,
            imports: item.imports ?? [],
            dynamicImports: item.dynamicImports ?? [],
            modules,
          };
        })
        .sort((a, b) => b.bytes - a.bytes);

      const outDir = path.resolve(process.cwd(), ".output", "analysis");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "bundle-analysis.json"),
        JSON.stringify({ generatedAt: new Date().toISOString(), chunks }, null, 2),
      );

      const html = `<!doctype html>
<meta charset="utf-8">
<title>Bundle analysis</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;line-height:1.4}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
code{font-family:ui-monospace,monospace;font-size:12px}
</style>
<h1>Bundle analysis</h1>
<p>Generated ${new Date().toLocaleString()}</p>
${chunks
  .map(
    (chunk) => `<h2>${chunk.fileName} (${Math.round(chunk.bytes / 1024)} KB)</h2>
<table><thead><tr><th>Module</th><th>KB</th></tr></thead><tbody>
${chunk.modules
  .slice(0, 60)
  .map((mod) => `<tr><td><code>${mod.id}</code></td><td>${(mod.bytes / 1024).toFixed(1)}</td></tr>`)
  .join("")}
</tbody></table>`,
  )
  .join("")}`;
      fs.writeFileSync(path.join(outDir, "bundle-analysis.html"), html);
    },
  };
}

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-is|use-sync-external-store)[\\/]/.test(id)) {
    return "vendor-react";
  }
  if (id.includes("@tanstack")) return "vendor-tanstack";
  if (id.includes("@supabase")) return "vendor-supabase";
  if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "vendor-ui";
  if (id.includes("lucide-react")) return "vendor-icons";
  if (id.includes("recharts") || id.includes("d3-") || id.includes("react-smooth")) return "vendor-charts";
  if (id.includes("@stripe") || /[\\/]node_modules[\\/]stripe[\\/]/.test(id)) return "vendor-stripe";
  if (id.includes("@anthropic-ai")) return "vendor-ai";
  if (id.includes("date-fns") || id.includes("zod")) return "vendor-utils";
}

// Bind the dev server to all interfaces so phones on the same WiFi can reach
// the host machine's LAN IP (otherwise the lovable plugin's sandbox detection
// may pick a host-only adapter like 192.168.56.x that the phone can't route to).
export default defineConfig({
  cloudflare: false,
  plugins: [
    nitro(),
    bundleAnalyzerPlugin(),
    ...(process.env.ANALYZE === "true"
      ? [
          visualizer({
            filename: path.resolve(process.cwd(), ".output", "analysis", "visualizer.html"),
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  vite: {
    server: {
      host: "0.0.0.0",
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  },
});
