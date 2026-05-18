import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crateRoot = resolve(packageRoot, "native", "rust");
const pkgDirFromCrate = "../../pkg";
const buildEnv = { ...process.env };
const pathKey = Object.keys(buildEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";

if (process.platform === "win32") {
  const llvmBin = "C:\\Program Files\\LLVM\\bin";

  if (existsSync(resolve(llvmBin, "clang++.exe"))) {
    buildEnv[pathKey] = `${llvmBin};${buildEnv[pathKey] ?? ""}`;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    env: buildEnv,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      console.error(
        [
          `Missing required command: ${command}`,
          "",
          "Install the Typai Wasm build prerequisites, then rerun this command:",
          "  rustup target add wasm32-unknown-unknown",
          "  cargo install wasm-pack --locked",
          "",
          "A wasm32-capable C++ compiler is also required because build.rs compiles native/cpp/typai_engine.cpp through the cc crate.",
        ].join("\n"),
      );
    } else {
      console.error(result.error.message);
    }

    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("wasm-pack", [
  "build",
  crateRoot,
  "--target",
  "web",
  "--out-dir",
  pkgDirFromCrate,
  "--out-name",
  "typai_wasm",
]);

rmSync(resolve(packageRoot, "pkg", ".gitignore"), { force: true });
