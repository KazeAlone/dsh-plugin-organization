# Development instructions

This is an experimental DSH host plugin and dependency-free Node.js organization kernel. Read README.md and docs/architecture.md before changes.

- Keep organizational roles separate from executable workflow nodes. Three provinces/six ministries is a template, not scheduler control flow.
- Use Node.js 24.9+ native ESM. The kernel must remain testable without DSH private packages or model credentials.
- Never make a model-facing tool capable of granting human approval or reconciling an unknown execution.
- Reviews/approvals bind exact artifact digests. Definition updates never silently change an existing run.
- Claims, run state and audit events change in one SQLite transaction; no async work inside transactions.
- Unknown outcomes retain resource quarantine. Do not automatically replay uncertain side effects or accept stale attempt results.
- Runtime rejection/settlement must wait for cleanup. Cleanup uncertainty must remain visible.
- Register DSH contributions as reversible Cordis effects. Keep host API ownership checks and adapters independently testable.
- Run npm run check and npm test for behavior changes, npm run demo for template changes, and npm pack --ignore-scripts --dry-run for packaging changes.
- Do not describe protocol fixtures or mock runtimes as real DSH/model end-to-end verification. Document unsupported capabilities explicitly.
