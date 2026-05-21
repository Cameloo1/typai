import { runCli } from "./build-production-dictionary.mjs";

try {
  await runCli("validate-production", readFlags());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function readFlags() {
  const flags = new Map();

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const separator = arg.indexOf("=");

    if (separator === -1) {
      flags.set(arg.slice(2), "true");
    } else {
      flags.set(arg.slice(2, separator), arg.slice(separator + 1));
    }
  }

  return flags;
}
