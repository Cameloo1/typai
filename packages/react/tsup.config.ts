import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: [
    "react",
    "react-dom",
    "@typai/core",
    "@typai/textarea",
    "@typai/contenteditable",
    "@typai/ui",
  ],
  format: ["esm"],
  sourcemap: true,
  target: "es2022",
});
