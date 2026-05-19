import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["app/api/typai/completion/route.ts"],
  external: [
    "@typai/completion-remote",
    "@typai/provider-proxy-example-utils",
    "@typai/provider-proxy-testkit",
    "vitest",
  ],
  format: ["esm"],
  sourcemap: true,
  target: "es2022",
});
