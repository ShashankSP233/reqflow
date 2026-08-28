# REQFLOW
## Professional Debug & Change Log

**Date:** 28 August 2026  
**Project:** ReqFlow  
**Repository:** `D:\Projects\reqflow`  
**Branch:** `main`

---

# 1. Legacy `departments.ts` Typecheck Failure

## 1.1 Error / Symptom

The API server typecheck failed with:

```text
src/routes/departments.ts(3,10): error TS2305:
Module '"@workspace/db"' has no exported member 'departmentsTable'.
```

The same missing database export was also reported from:

```text
src/routes/stats.ts
```

The failure occurred during the workspace typecheck:

```powershell
pnpm run typecheck
```

The API server stopped the recursive typecheck with exit status `2`.

---

## 1.2 Investigation

The error indicated that the API route was attempting to import a database table that was no longer exported by `@workspace/db`.

The related API-server errors were reviewed together because multiple routes were reporting missing database fields/exports.

The relevant errors included:

```text
departments.ts:
Module '"@workspace/db"' has no exported member 'departmentsTable'.
```

and:

```text
stats.ts:
Module '"@workspace/db"' has no exported member 'departmentsTable'.
```

This was compared against the current database package and the older ReqFlow copy.

The investigation established that `departments.ts` belonged to an older/legacy API implementation and referenced database structures that were no longer present in the current database schema/export surface.

---

## 1.3 Root Cause

`departments.ts` was legacy code.

It was still part of the API-server source tree, but the current `@workspace/db` package no longer exported the `departmentsTable` expected by that route.

Therefore the route and the current database layer were out of sync.

This was not a dependency-installation problem.

---

## 1.4 Change Made

The legacy department route was removed from the current code path.

The associated references to the obsolete department table were also removed so the API server would no longer attempt to compile against a database export that no longer existed.

---

## 1.5 Resolution

After removing the legacy department code, the corresponding:

```text
departmentsTable
```

compiler errors were eliminated.

The API server could then progress to the next set of typecheck errors instead of failing on the obsolete department route.

**Status: RESOLVED**

---

# 2. Legacy `items.ts` Typecheck Failure

## 2.1 Error / Symptom

The API server then reported multiple errors in:

```text
src/routes/items.ts
```

The first error was:

```text
TS2769:
No overload matches this call.
```

The insert object contained:

```text
unit_price
```

but the current database table type did not contain that property.

The compiler reported:

```text
Object literal may only specify known properties,
and 'unit_price' does not exist in type ...
```

Additional errors included:

```text
TS2339:
Property 'unit_price' does not exist on type ...
```

and:

```text
TS2339:
Property 'total_price' does not exist on type ...
```

There was also an error involving:

```text
total_amount
```

being passed to a requisition object whose current schema did not contain that field.

---

## 2.2 Investigation

The errors were traced to the current database schema/type definitions.

The route expected an older requisition-item structure containing fields such as:

```text
unit_price
total_price
```

while the current `requisition_items` table definition exposed a different structure.

The route was therefore attempting to compile an older data model against the current database package.

The pattern matched the earlier `departments.ts` failure:

```text
legacy route
    ↓
old database field names
    ↓
current @workspace/db
    ↓
TypeScript compilation failure
```

This established that `items.ts` was another legacy route rather than a newly introduced frontend problem.

---

## 2.3 Root Cause

`items.ts` was legacy code that had not been brought forward with the current database schema.

It still referenced fields such as:

```text
unit_price
total_price
total_amount
```

that were not part of the current database model.

---

## 2.4 Change Made

The obsolete `items.ts` route was removed rather than attempting to retrofit its old database model into the current system.

This avoided introducing obsolete columns or changing the current database schema simply to satisfy unused legacy code.

---

## 2.5 Resolution

The `items.ts` database-field errors were removed from the API-server typecheck.

The current database schema was left intact.

This was the safer resolution because the problem was obsolete route code rather than a missing current database feature.

**Status: RESOLVED**

---

# 3. Legacy `stats.ts` Typecheck Failure

## 3.1 Error / Symptom

`src/routes/stats.ts` generated a series of database/type errors.

The errors included:

```text
Module '"@workspace/db"' has no exported member 'departmentsTable'.
```

and missing database properties including:

```text
total_amount
title
description
requester_name
requester_email
department_id
approval_notes
```

Examples from the compiler output included:

```text
Property 'total_amount' does not exist on type 'PgTableWithColumns<...>'
```

```text
Property 'title' does not exist on type 'PgTableWithColumns<...>'
```

```text
Property 'requester_name' does not exist on type 'PgTableWithColumns<...>'
```

```text
Property 'department_id' does not exist on type 'PgTableWithColumns<...>'
```

```text
Property 'approval_notes' does not exist on type 'PgTableWithColumns<...>'
```

---

## 3.2 Investigation

The number and nature of the missing fields showed that this was not one isolated missing property.

The route expected an older requisition schema containing a collection of fields that were absent from the current `requisitions` table definition.

The route also depended on the obsolete:

```text
departmentsTable
```

export.

This linked `stats.ts` directly to the same legacy database model identified in `departments.ts` and `items.ts`.

---

## 3.3 Root Cause

`stats.ts` was another legacy route built around an older requisition/database structure.

The current database schema had evolved, while this route continued to reference the previous model.

Attempting to "fix" the errors by adding the old columns back would have changed the current database contract unnecessarily.

---

## 3.4 Change Made

The obsolete `stats.ts` route was removed from the current API code.

No legacy database fields were reintroduced.

---

## 3.5 Resolution

The large group of obsolete database-field errors disappeared from the API-server typecheck.

The API server then completed its typecheck successfully after the remaining valid application/type errors were resolved.

**Status: RESOLVED**

---

# 4. `RoleContext.tsx` — Missing `director` Role

## 4.1 Error / Symptom

The requisition frontend reported:

```text
src/context/RoleContext.tsx:73:3 - error TS2353

Object literal may only specify known properties,
and 'director' does not exist in type 'Record<Role, string>'.
```

The code contained:

```ts
director: "Director",
```

but the `Role` type did not include `director`.

---

## 4.2 Investigation

The compiler was checking the role-to-display-name object against:

```ts
Record<Role, string>
```

The object contained `director`, so TypeScript required `director` to be a member of `Role`.

The error therefore came from an inconsistency between:

```text
available role mapping
```

and:

```text
Role type definition
```

---

## 4.3 Root Cause

The role mapping and the declared role type had diverged.

The application contained a `director` role mapping, but the corresponding role union/type did not recognize `director`.

---

## 4.4 Change Made

The role definitions were aligned so that the `director` role was represented consistently.

---

## 4.5 Resolution

The `Record<Role, string>` error was removed.

The role mapping and role type now agree.

**Status: RESOLVED**

---

# 5. `CreateRequisition.tsx` — `asset_name` Type Mismatch

## 5.1 Error / Symptom

The requisition page reported:

```text
src/pages/CreateRequisition.tsx:100:11 - error TS2322
```

The generated item object contained:

```text
asset_name: string | null
```

while the generated API input expected:

```text
asset_name?: string
```

The compiler reported:

```text
Type 'string | null' is not assignable to type 'string | undefined'.
```

---

## 5.2 Investigation

The error occurred while mapping form items into:

```ts
RequisitionItemInput[]
```

The frontend form/data layer allowed an asset name to be explicitly `null`.

The generated API client represented an absent asset name as:

```text
undefined
```

rather than:

```text
null
```

The two representations therefore did not match.

---

## 5.3 Root Cause

There was a nullability mismatch between the frontend form value and the generated API input type.

This was a TypeScript contract mismatch rather than a database failure.

---

## 5.4 Change Made

The item mapping was corrected so the value supplied to the generated API client conforms to the API client's expected optional-string representation.

---

## 5.5 Resolution

The `asset_name` assignment became type-compatible with:

```text
RequisitionItemInput
```

and the compiler error was removed.

**Status: RESOLVED**

---

# 6. `Dashboard.tsx` — Missing `on_hold` Analytics Property

## 6.1 Error / Symptom

The dashboard reported:

```text
src/pages/Dashboard.tsx:48:23 - error TS2339
```

Specifically:

```text
Property 'on_hold' does not exist on type 'AnalyticsSummary'.
```

The page used:

```ts
summary?.on_hold ?? 0
```

---

## 6.2 Investigation

The frontend expected the analytics summary to expose an `on_hold` value.

The generated `AnalyticsSummary` type did not contain that property.

This indicated that the frontend/API type contract was behind the current analytics data being used by the application.

---

## 6.3 Root Cause

The generated analytics type and the application data contract were not synchronized.

The dashboard was using a valid field from the current application model, but the generated API definition did not describe it.

---

## 6.4 Change Made

The API specification and corresponding generated API definitions were aligned with the current analytics structure.

Affected generated files included:

```text
lib/api-client-react/src/generated/api.schemas.ts
lib/api-client-react/src/generated/api.ts
lib/api-zod/src/generated/api.ts
```

with the source contract represented in:

```text
lib/api-spec/openapi.yaml
```

---

## 6.5 Resolution

The `AnalyticsSummary` type now matches the data consumed by the dashboard.

The `on_hold` TypeScript error was removed.

**Status: RESOLVED**

---

# 7. `RequisitionDetail.tsx` — Approval Notes Query Options

## 7.1 Error / Symptom

The page reported:

```text
src/pages/RequisitionDetail.tsx:99:62 - error TS2741
```

The compiler reported:

```text
Property 'queryKey' is missing in type '{ enabled: boolean; }'
```

The affected call was:

```ts
useListApprovalNotes(id, {
  query: {
    enabled: !!id
  }
});
```

---

## 7.2 Investigation

The generated hook's expected query-options type was inspected.

The generated React Query client expected a particular options shape, and the object being passed from the page was not compatible with that generated signature.

---

## 7.3 Root Cause

The frontend call and generated query hook definition had diverged.

The problem was not with approval notes themselves; it was the shape of the options being supplied to the generated hook.

---

## 7.4 Change Made

The query invocation was corrected to conform to the generated client's expected query-options type.

---

## 7.5 Resolution

The missing `queryKey` TypeScript error was removed.

**Status: RESOLVED**

---

# 8. `RequisitionDetail.tsx` — `ApiError` `instanceof` Error

## 8.1 Error / Symptom

The page reported:

```text
src/pages/RequisitionDetail.tsx:145:25 - error TS2358
```

At:

```ts
const isForbidden =
  error instanceof ApiError && error.status === 403;
```

The compiler stated:

```text
The left-hand side of an 'instanceof' expression
must be of type 'any', an object type or a type parameter.
```

---

## 8.2 Investigation

The generated query/mutation error value was not sufficiently narrowed for TypeScript to treat it as an object suitable for:

```ts
instanceof ApiError
```

The generated client was using its default error typing rather than guaranteeing `ApiError`.

---

## 8.3 Root Cause

The runtime error handling expected a concrete `ApiError`, while the compile-time type of the error value was broader.

This was a TypeScript narrowing problem.

---

## 8.4 Change Made

The error handling was adjusted so the error value could be safely narrowed before using the `instanceof ApiError` check.

The existing intent was preserved:

```text
identify a 403/forbidden response
```

---

## 8.5 Resolution

The invalid `instanceof` compiler error was removed without changing the intended 403 handling behavior.

**Status: RESOLVED**

---

# 9. `RequisitionDetail.tsx` — Possibly Undefined `req`

## 9.1 Error / Symptom

The page reported:

```text
src/pages/RequisitionDetail.tsx:176:19 - error TS18048
```

The compiler stated:

```text
'req' is possibly 'undefined'.
```

The affected code accessed:

```ts
req.items
```

---

## 9.2 Investigation

The requisition data comes from an asynchronous query.

Therefore TypeScript could not guarantee that `req` existed at every point where the edit state was initialized.

The existing item fallback:

```ts
req.items ?? []
```

only protected against `items` being undefined; it did not prove that the parent `req` object existed.

---

## 9.3 Root Cause

The code assumed the requisition query had already returned data at a point where TypeScript correctly considered it potentially undefined.

---

## 9.4 Change Made

The edit-state initialization was made safe for the case where the requisition object is not yet available.

---

## 9.5 Resolution

The compiler no longer reports:

```text
'req' is possibly 'undefined'
```

The edit flow retains the existing empty-item fallback.

**Status: RESOLVED**

---

# 10. `RequisitionDetail.tsx` — `update_date` Incorrectly Required

## 10.1 Error / Symptom

The status update mutation produced:

```text
src/pages/RequisitionDetail.tsx:944:52 - error TS2741
```

The compiler reported:

```text
Property 'update_date' is missing in type
'{ updated_by_name: string; stage: string; notes: string; }'
but required in type 'StatusUpdateInput'.
```

The frontend supplied:

```ts
{
  updated_by_name: user.name,
  stage: vals.stage,
  notes: vals.notes
}
```

---

## 10.2 Investigation

The API route was inspected.

The backend status-update implementation sets:

```ts
update_date: todayIST()
```

The route therefore generates the date itself.

The investigation also found that the OpenAPI specification had:

```yaml
StatusUpdateInput:
  required: [updated_by_name, stage, update_date]
```

This caused the generated frontend type to require a value that the backend explicitly generates.

---

## 10.3 Root Cause

The OpenAPI contract incorrectly described a server-generated field as a required client input.

The backend and frontend implementation were correct in principle; the generated type was enforcing an inaccurate API contract.

---

## 10.4 Change Made

`lib/api-spec/openapi.yaml` was corrected so `update_date` is not incorrectly required from the client.

The corresponding generated files were updated:

```text
lib/api-client-react/src/generated/api.schemas.ts
lib/api-client-react/src/generated/api.ts
lib/api-zod/src/generated/api.ts
```

---

## 10.5 Resolution

The frontend can now send the actual client-controlled fields:

```text
updated_by_name
stage
notes
```

while the server continues to generate:

```text
update_date
```

The TypeScript error was removed.

**Status: RESOLVED**

---

# 11. `SetupUsers.tsx` — Password-Only Update Rejected by Generated Type

## 11.1 Error / Symptom

The user setup page reported:

```text
src/pages/SetupUsers.tsx:80:41 - error TS2739
```

The compiler stated:

```text
Type '{ password: string; }' is missing the following
properties from type 'UserInput': name, role
```

The frontend password reset call supplied:

```ts
{
  password: resetPassword
}
```

---

## 11.2 Investigation

The existing backend PATCH route was inspected.

The route accepts:

```text
name
email
role
site_name
password
project_ids
```

and updates fields conditionally.

The backend specifically supports:

```ts
if (password) updates.password_hash = hashPassword(password);
```

Therefore the backend already supports a password-only update.

The problem was with the generated input type.

---

## 11.3 Root Cause

The generated `UserInput` type required:

```text
name
role
```

even for the partial user-update operation.

This made a valid password-only PATCH appear invalid to TypeScript.

---

## 11.4 Change Made

The API specification was corrected so the update contract accurately represents the partial nature of the PATCH operation.

The generated API schema/client types were updated accordingly.

---

## 11.5 Resolution

The existing password reset call:

```ts
data: { password: resetPassword }
```

now conforms to the generated update type.

No new password-reset endpoint was required.

The existing backend password hashing/update behavior was retained.

**Status: RESOLVED**

---

# 12. Zod / React Hook Form Resolver Compatibility

## 12.1 Error / Symptom

After the other type errors were addressed, `CreateRequisition.tsx` still failed at:

```ts
resolver: zodResolver(formSchema),
```

with:

```text
TS2345:
Argument of type 'ZodObject<...>' is not assignable to parameter
of type 'ZodType<...>'
```

The detailed error included Zod 4-specific members:

```text
def
type
toJSONSchema
check
```

---

## 12.2 Investigation — Source Code

`CreateRequisition.tsx` imports:

```ts
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
```

The schema is created with:

```ts
const formSchema = z.object(...)
```

The recent Save as Draft implementation was also reviewed because it was one of the earliest changes made to this page.

The Draft feature uses:

```ts
form.getValues()
```

to save data and:

```ts
form.reset(draft)
```

to restore data.

It does not create a separate resolver or Zod instance.

Therefore the Draft implementation was not identified as the direct source of the resolver type error.

---

## 12.3 Investigation — Actual Module Resolution

The actual Zod module used by the requisition source was checked.

Result:

```text
CreateRequisition zod:
D:\Projects\reqflow\node_modules\.pnpm\zod@3.25.76
\node_modules\zod\index.cjs
```

The Zod module resolved from the resolver was then checked.

Result:

```text
resolver zod:
D:\Projects\reqflow\node_modules\.pnpm\zod@4.4.3
\node_modules\zod\index.cjs
```

This was the decisive evidence.

The two sides were using different Zod major versions:

```text
CreateRequisition schema
        ↓
Zod 3.25.76

@hookform/resolvers
        ↓
Zod 4.4.3
```

---

## 12.4 Root Cause

The resolver boundary was combining incompatible Zod major-version types.

The form schema was a Zod 3 schema.

The installed resolver was resolving Zod 4 types.

Therefore TypeScript rejected:

```ts
zodResolver(formSchema)
```

even though the schema itself was valid.

---

## 12.5 Investigation — Dependency Tree

The requisition package dependency tree showed:

```text
@workspace/requisition
├─ @hookform/resolvers@3.10.0
├─ react-hook-form@7.84.0
└─ zod@3.25.76
```

The lockfile contained both:

```text
zod@3.25.76
zod@4.4.3
```

This was not treated as inherently wrong because the workspace contains packages using different Zod versions.

The important problem was the resolver crossing the Zod 3/Zod 4 boundary.

---

## 12.6 Failed Reinstallation Test

A forced installation was attempted:

```powershell
pnpm install --force
```

The result was:

```text
Already up to date
```

The same TypeScript error remained.

This ruled out a simple corrupted/incomplete `node_modules` installation.

---

## 12.7 Temporary Explicit Zod Test

Zod 3.25.76 was temporarily added explicitly to the requisition package:

```powershell
pnpm add zod@3.25.76 --filter @workspace/requisition
```

`pnpm why zod` then showed:

```text
zod@3.25.76
└── @workspace/requisition@0.0.0
```

However, the resolver still resolved Zod 4.

The typecheck therefore continued to fail.

This demonstrated that hardcoding Zod 3 in the requisition package was not the actual solution.

The package was subsequently returned to:

```json
"zod": "catalog:"
```

---

## 12.8 Change Made

The resolver dependency was upgraded:

```diff
- "@hookform/resolvers": "^3.10.0",
+ "@hookform/resolvers": "^5.1.0",
```

Zod was kept catalog-managed:

```json
"zod": "catalog:"
```

The workspace was not globally forced onto Zod 4.

The lockfile was updated through pnpm.

---

## 12.9 Resolution

After the resolver update:

```powershell
pnpm install
```

was run.

Then:

```powershell
pnpm --filter @workspace/requisition run typecheck
```

completed successfully.

The previous:

```text
ZodObject is not assignable to ZodType
```

error disappeared.

The full workspace typecheck was subsequently run successfully.

**Status: RESOLVED**

---

# 13. API / Generated-Type Synchronization

Several of the typecheck errors were not isolated frontend mistakes.

They exposed differences between:

```text
OpenAPI specification
        ↓
generated API client
        ↓
generated Zod schemas
        ↓
frontend usage
        ↓
actual backend behavior
```

The affected source/API files were:

```text
lib/api-spec/openapi.yaml
lib/api-client-react/src/generated/api.schemas.ts
lib/api-client-react/src/generated/api.ts
lib/api-zod/src/generated/api.ts
```

The changes brought these layers back into alignment.

This was particularly important for:

- `StatusUpdateInput`
- partial `UserInput` updates
- analytics summary data

---

# 14. Files Changed

## Application source

```text
artifacts/requisition/src/context/RoleContext.tsx
artifacts/requisition/src/pages/CreateRequisition.tsx
artifacts/requisition/src/pages/Dashboard.tsx
artifacts/requisition/src/pages/RequisitionDetail.tsx
artifacts/requisition/src/pages/SetupUsers.tsx
```

## API specification / generated code

```text
lib/api-spec/openapi.yaml
lib/api-client-react/src/generated/api.schemas.ts
lib/api-client-react/src/generated/api.ts
lib/api-zod/src/generated/api.ts
```

## Dependency files

```text
artifacts/requisition/package.json
pnpm-lock.yaml
```

## Legacy routes removed

```text
artifacts/api-server/src/routes/departments.ts
artifacts/api-server/src/routes/items.ts
artifacts/api-server/src/routes/stats.ts
```

These three files were removed because they were legacy routes tied to the obsolete database model.

---

# 15. Verification

## Requisition Package

Command:

```powershell
pnpm --filter @workspace/requisition run typecheck
```

Result:

```text
$ tsc -p tsconfig.json --noEmit
```

**PASS**

---

## Complete Workspace

Command:

```powershell
pnpm run typecheck
```

Result:

```text
artifacts/api-server typecheck
└─ Done

artifacts/requisition typecheck
└─ Done
```

**PASS**

No TypeScript errors remained.

The informational message:

```text
No projects matched the filters "...\\scripts"
```

was not a compilation failure. The actual API-server and requisition projects completed successfully.

---

# 16. Manual Functional Verification

The affected requisition functionality was manually tested after the typecheck passed.

Verified:

- Create Requisition page loads correctly.
- Form inputs continue to work.
- Form validation continues to work.
- Save as Draft works.
- Draft data can be restored.
- Restored draft data can be submitted.
- Normal requisition creation works.
- Affected requisition/detail functionality continues to work.

**Manual test result: PASS**

---

# 17. Final Dependency Configuration

Final requisition dependency configuration:

```json
"@hookform/resolvers": "^5.1.0",
"zod": "catalog:"
```

The temporary:

```json
"zod": "3.25.76"
```

entry was not retained.

The existing workspace catalog remains responsible for the Zod version.

---

# 18. Git Change Record

The dependency change was isolated as its own change:

```text
@hookform/resolvers
3.10.0 → 5.1.0
```

The other application/API type corrections were staged separately.

The completed changes were committed and pushed to `origin/main`.

The repository was subsequently clean with respect to the completed changes.

---

# 19. Resolution Summary

| # | Issue | Root Cause | Resolution |
|---|---|---|---|
| 01 | `departments.ts` | Legacy route referenced removed `departmentsTable` | Removed legacy route |
| 02 | `items.ts` | Legacy route referenced obsolete item/requisition fields | Removed legacy route |
| 03 | `stats.ts` | Legacy route referenced obsolete requisition/department fields | Removed legacy route |
| 04 | `RoleContext.tsx` | `director` missing from `Role` type | Aligned role type and mapping |
| 05 | `CreateRequisition.tsx` | `asset_name` nullability mismatch | Corrected item mapping/type |
| 06 | `Dashboard.tsx` | Generated analytics type missing `on_hold` | Aligned API/generated types |
| 07 | `RequisitionDetail.tsx` | Query options mismatched generated hook type | Corrected query options |
| 08 | `RequisitionDetail.tsx` | Error value not narrowed for `instanceof` | Corrected error narrowing |
| 09 | `RequisitionDetail.tsx` | Requisition query data may be undefined | Added safe undefined handling |
| 10 | `RequisitionDetail.tsx` | Server-generated `update_date` incorrectly required by OpenAPI | Corrected API contract/generated types |
| 11 | `SetupUsers.tsx` | Partial PATCH incorrectly typed as requiring `name`/`role` | Corrected update API typing |
| 12 | `CreateRequisition.tsx` Zod resolver | Resolver resolved Zod 4 while form resolved Zod 3 | Upgraded `@hookform/resolvers` to 5.1.0 |

---

# 20. Final Status

**DEBUG STATUS: RESOLVED**

**TYPECHECK STATUS: PASS**

**MANUAL TEST STATUS: PASS**

**DEPENDENCY FIX: COMPLETE**

**API TYPE ALIGNMENT: COMPLETE**

**GIT COMMIT/PUSH: COMPLETE**

The final laptop ReqFlow codebase passes the complete configured typecheck, and the affected requisition workflows were manually verified after the changes.
