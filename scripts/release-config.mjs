export const repositoryUrl = "git+https://github.com/Cameloo1/typai.git";

export const releasePackages = [
  {
    name: "@typai/core",
    directory: "packages/core",
    role: "public",
    requiredFiles: ["dist", "pkg", "README.md"],
    requiredPackedFiles: [
      "dist/index.js",
      "dist/index.d.ts",
      "pkg/typai_wasm.js",
      "pkg/typai_wasm_bg.wasm",
      "README.md",
    ],
    peerDependencies: [],
    requiresWasm: true,
  },
  {
    name: "@typai/contenteditable",
    directory: "packages/contenteditable",
    role: "public",
    requiredFiles: ["dist", "README.md"],
    requiredPackedFiles: ["dist/index.js", "dist/index.d.ts", "README.md"],
    peerDependencies: [],
  },
  {
    name: "@typai/textarea",
    directory: "packages/textarea",
    role: "public",
    requiredFiles: ["dist", "README.md"],
    requiredPackedFiles: ["dist/index.js", "dist/index.d.ts", "README.md"],
    peerDependencies: [],
  },
  {
    name: "@typai/ui",
    directory: "packages/ui",
    role: "support",
    requiredFiles: ["dist", "README.md"],
    requiredPackedFiles: ["dist/index.js", "dist/index.d.ts", "README.md"],
    peerDependencies: [],
  },
  {
    name: "@typai/react",
    directory: "packages/react",
    role: "public",
    requiredFiles: ["dist", "README.md"],
    requiredPackedFiles: ["dist/index.js", "dist/index.d.ts", "README.md"],
    peerDependencies: ["react", "react-dom"],
  },
  {
    name: "@typai/codemirror",
    directory: "packages/codemirror",
    role: "public",
    requiredFiles: ["dist", "README.md"],
    requiredPackedFiles: ["dist/index.js", "dist/index.d.ts", "README.md"],
    peerDependencies: ["@codemirror/language", "@codemirror/state", "@codemirror/view"],
  },
  {
    name: "@typai/completion-remote",
    directory: "packages/completion-remote",
    role: "public",
    requiredFiles: ["dist", "README.md"],
    requiredPackedFiles: ["dist/index.js", "dist/index.d.ts", "README.md"],
    peerDependencies: [],
  },
];

export const publicPackageNames = releasePackages
  .filter((pkg) => pkg.role === "public")
  .map((pkg) => pkg.name);

export const releasePackageNames = releasePackages.map((pkg) => pkg.name);

export const privateWorkspacePackages = [
  "@typai/adapter-testkit",
  "@typai/provider-proxy-testkit",
  "@typai/provider-proxy-example-utils",
  "simple-demo-editor",
  "provider-proxy-express",
  "provider-proxy-next",
  "provider-proxy-cloudflare-worker",
  "consumer-vanilla-contenteditable",
  "consumer-vanilla-textarea",
  "consumer-react",
  "consumer-codemirror",
  "consumer-completion-with-proxy",
  "golden-corpus",
];

export const requiredReleaseScripts = [
  "release:check",
  "release:version:dry",
  "release:pack",
  "release:publish:dry",
  "bench:spell-quality",
  "scan:package-secrets",
  "pack:dry",
  "smoke:install",
  "smoke:public-beta",
];
