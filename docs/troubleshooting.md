# Troubleshooting

This page covers the current public beta: `0.0.0-beta.0` on npm under the
`beta` dist-tag. Registry smoke passed from public npm packages.

## Package Install Fails

Use the beta tag or exact version:

```sh
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@0.0.0-beta.0 @typai/textarea@0.0.0-beta.0
```

If npm resolves `latest`, note that `latest` currently points at
`0.0.0-beta.0` because these were first publishes. That is not a stable-release
signal.

If a package cannot be found, check:

- package name uses the `@typai/` scope
- package is installed from npm, not a local folder by accident
- lockfile is not pinning an older failed install
- npm registry is `https://registry.npmjs.org/`

## Nothing Corrects

Check:

- `createTypaiCore()` completed
- the adapter was attached to the intended element
- the typed token is completed with a delimiter such as space or punctuation
- autocorrect is enabled
- the token is not protected-looking
- the token is actually in the conservative autocorrect table

The built-in table is deliberately small. For example, `teh` corrects to `the`;
`form` must remain unchanged.

## Textarea Marks Look Offset

Native textareas cannot contain inline spans. Typai uses an overlay for marks.
Keep the textarea and overlay styles aligned:

- font family
- font size
- line height
- padding
- border sizing
- scroll position

After layout changes, call the adapter resync/update path exposed by the
textarea integration.

## Completion Does Not Appear

Completion is optional. Confirm:

- a completion controller is configured
- the prefix is long enough
- the endpoint is reachable
- the proxy is running in mock mode for local examples
- the ghost was not dismissed by typing, blur, selection change, paste,
  composition, or Escape

Completion is not part of `@typai/core`; install and configure
`@typai/completion-remote` when you need it.

## Provider Proxy Returns Errors

Proxy errors are intentionally terse. Check the server logs for:

- request ID
- provider mode
- HTTP status
- context length
- completion length
- latency

Do not log full editor context or provider secrets by default.

## Production Dictionary Coverage Is Missing

This is expected in the beta. Production dictionary and frequency assets are not
bundled. The current package set includes deterministic correction, a
conservative common typo table, suggestions, and host-provided dictionary
loading.

Production coverage requires a later approved production asset or a
host-provided Typai Dictionary Blob v1 supplied by the app.

## Real Provider Setup Fails

The real-provider path is manual and server-side. It requires:

- `TYPAI_ALLOW_REAL_PROVIDER_TEST=1`
- `PROVIDER_MODE=openai`
- a server-side `OPENAI_API_KEY`
- a proxy endpoint running outside browser package code

Automated tests, demos, and CI stay on mock provider paths.

## What Not To Do

- Do not put provider credentials in browser code.
- Do not treat `latest` as a stable release signal yet.
- Do not claim production dictionary coverage from the beta packages.
- Do not modify dist-tags or deprecate packages without an explicit release
  decision.
