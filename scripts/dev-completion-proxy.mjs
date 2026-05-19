import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { delimiter, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const endpointPath = "/api/typai/completion";
const host = process.env.TYPAI_COMPLETION_PROXY_HOST || process.env.HOST || "127.0.0.1";
const port = readPort(process.env.TYPAI_COMPLETION_PROXY_PORT || process.env.PORT || "8787");

buildProviderProxy();

const proxyModule = await import(
  pathToFileURL(resolve(repoRoot, "examples/provider-proxy-express/dist/index.js")).href
);
const env = {
  ...proxyModule.readProviderProxyEnv(),
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || "http://127.0.0.1:5173",
};
let config;

try {
  config = proxyModule.validateEnv(env);

  if (config.providerMode === "openai" && process.env.TYPAI_ALLOW_REAL_PROVIDER_TEST !== "1") {
    throw new Error("TYPAI_ALLOW_REAL_PROVIDER_TEST=1 is required for openai mode.");
  }
} catch (error) {
  console.error(`Completion proxy refused to start: ${getSafeErrorMessage(error)}`);
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  if (url.pathname !== endpointPath) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "Not found." } }));
    return;
  }

  try {
    const bodyText =
      (request.method ?? "").toUpperCase() === "OPTIONS" ? "" : await readRequestBody(request);
    const proxyResponse = await proxyModule.handleTypaiExpressCompletionRequest(
      {
        method: request.method,
        headers: request.headers,
        bodyText,
      },
      env,
    );

    response.writeHead(proxyResponse.status, proxyResponse.headers);
    response.end(proxyResponse.body);
  } catch {
    response.writeHead(413, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        error: {
          code: "invalid_request",
          message: "The completion proxy request was invalid.",
        },
      }),
    );
  }
});

server.listen(port, host, () => {
  console.log(`Typai completion proxy listening at http://${host}:${port}${endpointPath}`);
  console.log(`Provider mode: ${config.providerMode}`);
  console.log(`Allowed origin: ${config.allowedOrigin}`);

  if (config.providerMode === "openai") {
    console.log(`OpenAI model: ${config.openai?.model ?? "unknown"}`);
  }
});

function buildProviderProxy() {
  const command = resolveCommand("pnpm", ["--filter", "provider-proxy-express", "build"]);
  const result = spawnSync(command.command, command.args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: createCommandEnv(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readRequestBody(request) {
  const maxBytes = 128 * 1024;
  let size = 0;
  const chunks = [];

  return new Promise((resolveBody, rejectBody) => {
    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxBytes) {
        rejectBody(new Error("Request body too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", rejectBody);
  });
}

function readPort(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error("TYPAI_COMPLETION_PROXY_PORT must be a valid TCP port.");
  }

  return parsed;
}

function resolveCommand(command, args) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `${command}.cmd`, ...args],
    };
  }

  return { command, args };
}

function createCommandEnv() {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const currentPath = process.env[pathKey] ?? process.env.PATH ?? "";
  const localBins = [resolve(repoRoot, ".codex-tools"), resolve(repoRoot, "node_modules", ".bin")];

  return {
    ...process.env,
    [pathKey]: [...localBins, currentPath].filter(Boolean).join(delimiter),
  };
}

function getSafeErrorMessage(error) {
  return error instanceof Error ? error.message : "invalid provider proxy configuration";
}
