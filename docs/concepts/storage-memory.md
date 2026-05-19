# Storage And Memory

Typai supports local memory for user-controlled correction behavior.

Current public storage concepts:

- in-memory storage for demos and tests
- IndexedDB storage for browser persistence
- personal dictionary import, export, and reset
- correction rule import, export, and reset

Memory APIs are user-controlled. Typai does not sync memory to a Typai service.
Embedders can choose how to expose import, export, and reset in their own UI.
