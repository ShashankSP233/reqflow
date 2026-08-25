// Re-exports the orval-generated zod schemas (runtime validators, e.g.
// `HealthCheckResponse.parse(...)` as used in api-server/src/routes/health.ts).
//
// This file itself is hand-written (mirrors @workspace/db's src/index.ts) —
// everything it points at gets (re)created by running:
//
//   pnpm --filter @workspace/api-spec run codegen
//
// Confirmed against a real `pnpm --filter @workspace/api-spec run codegen`
// run: this orval version (8.20.0) outputs the runtime schemas directly to
// `generated/api.ts` (not `generated/api.zod.ts` as first guessed), with
// per-schema TS types separately under `generated/types/`.
export * from "./generated/api";
