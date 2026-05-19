const requiredFlags = {
  TYPAI_ALLOW_REAL_PROVIDER_TEST: "1",
  PROVIDER_MODE: "openai",
};

const missing = Object.entries(requiredFlags)
  .filter(([name, expected]) => process.env[name] !== expected)
  .map(([name]) => `${name}=${requiredFlags[name]}`);

if (!process.env.OPENAI_API_KEY) {
  missing.push("OPENAI_API_KEY");
}

if (missing.length > 0) {
  console.log(
    `Manual real-provider smoke skipped. Required opt-in is missing: ${missing.join(", ")}.`,
  );
  process.exit(0);
}

const startedAt = performance.now();
const { handleTypaiExpressCompletionRequest } = await import(
  "../examples/provider-proxy-express/dist/index.js"
);

const response = await handleTypaiExpressCompletionRequest(
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    bodyText: JSON.stringify({
      request: {
        id: "manual-real-provider-smoke",
        mode: "prose",
        contextBefore: "Public beta readiness means the provider proxy",
        contextAfter: "",
        currentLine: "Public beta readiness means the provider proxy",
        cursorOffset: 47,
        maxCompletionChars: 80,
        stopSequences: [],
        instruction: {
          task: "continue",
          style: "same_voice",
          output: "continuation_only",
          constraints: ["Return only text that should be inserted at the cursor."],
        },
        metadata: {
          source: "manual-real-provider-smoke",
        },
      },
    }),
  },
  {
    PROVIDER_MODE: process.env.PROVIDER_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS,
    ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  },
);

const latencyMs = Math.round(performance.now() - startedAt);
const body = JSON.parse(response.body);

if (response.status < 200 || response.status >= 300) {
  const code = body?.error?.code ?? "unknown_error";
  console.error(`Manual real-provider smoke failed safely: status=${response.status} code=${code}`);
  process.exit(1);
}

console.log(
  [
    "Manual real-provider smoke passed.",
    `latencyMs=${latencyMs}`,
    `model=${body.model ?? process.env.OPENAI_MODEL ?? "unknown"}`,
    `completionChars=${typeof body.text === "string" ? body.text.length : 0}`,
  ].join(" "),
);
