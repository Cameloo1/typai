import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: [
    "@codemirror/language",
    "@codemirror/state",
    "@codemirror/view",
    "@typai/core",
    "@typai/ui",
  ],
  format: ["esm"],
  sourcemap: true,
  target: "es2022",
});
