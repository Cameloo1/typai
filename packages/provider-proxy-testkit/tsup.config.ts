import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: ["@typai/completion-remote", "vitest"],
  format: ["esm"],
  sourcemap: true,
  target: "es2022",
});
