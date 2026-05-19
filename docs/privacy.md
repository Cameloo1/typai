# Privacy

Typai separates local correction from optional completion.

Local correction:

- runs in the browser
- checks completed tokens
- keeps personal dictionary memory local by default
- does not send text to a Typai service

Optional completion:

- sends bounded context only when configured
- calls an embedder-owned endpoint
- renders ghost text before insertion
- requires explicit user acceptance before editor mutation

Provider proxy security and retention policy are the embedder's responsibility.

See also:

- [Provider proxy concept](./concepts/provider-proxy.md)
