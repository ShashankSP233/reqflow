// Re-exports the orval-generated API client.
//
// This file itself is hand-written (mirrors the pattern used by
// @workspace/db's src/index.ts) — but everything it points at gets
// (re)created by running:
//
//   pnpm --filter @workspace/api-spec run codegen
//
// RECONSTRUCTION NOTE: this package was missing from the project export
// (see SETUP.md). The filenames below follow orval.config.ts's own comment
// ("Our exports make assumptions about the title of the API being 'Api',
// i.e. generated output is `api.ts`"). If your installed orval version
// names things differently, TypeScript will fail with a clear
// "Cannot find module './generated/...'" pointing at exactly which line
// below to fix — it's a one-line change, not a functional bug.
export * from "./generated/api";
export * from "./generated/api.schemas";
export { ApiError } from "./custom-fetch";
