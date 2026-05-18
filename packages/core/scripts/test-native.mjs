import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crateRoot = resolve(packageRoot, "native", "rust");

const result = spawnSync("cargo", ["test", "--manifest-path", resolve(crateRoot, "Cargo.toml")], {
  cwd: packageRoot,
  env: {
    ...process.env,
    RUST_TEST_THREADS: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
