import { defineConfig, searchForWorkspaceRoot } from "vite";

export default defineConfig({
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
    host: "127.0.0.1",
    port: 5173,
  },
});
