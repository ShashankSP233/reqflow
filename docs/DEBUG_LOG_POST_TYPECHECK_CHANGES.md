# ReqFlow --- Post-Typecheck Debug & Change Log

**Project:** ReqFlow\
**Developer:** Shashank\
**Purpose:** Continuation of `DEBUG_LOG_TYPECHECK_FIXES.md`\
**Coverage:** Changes made after the previous typecheck/API-alignment
work.

------------------------------------------------------------------------

## 1. Scope

This continuation records:

1.  Purchase Member requisition visibility correction.
2.  Status-update timestamp display correction.
3.  Full item description and remark display.
4.  Completed-requisition download system.
5.  Printable PDF redesign and issues found during testing.
6.  Approver/Purchase Head priority-change functionality.
7.  Production data correction for requisitions created under the wrong
    project.
8.  Deployment and validation considerations.

No database schema migration was introduced by these application
features.

------------------------------------------------------------------------

# 2. Purchase Member Requisition Visibility

## Error / Symptom

Purchase Members were being restricted by the frontend to requisitions
assigned directly to them.

The frontend contained logic equivalent to:

``` ts
if (user.role === "purchase_member") {
  params.assigned_to_id = user.id;
}
```

This unnecessarily narrowed the requisition list.

## Investigation

The backend `/requisitions` route already handled project-based access
and personal involvement.

The frontend assignment filter was therefore overriding the intended
broader visibility.

## Change Made

The frontend-only assignment filter was disabled:

``` ts
// if (user.role === "purchase_member") params.assigned_to_id = user.id;
```

The backend remains responsible for determining which requisitions the
Purchase Member can access.

## Result

Purchase Members can now see requisitions permitted by the existing
backend project/personal access rules rather than only requisitions
assigned to them.

## Validation

Manual testing confirmed the change works.

------------------------------------------------------------------------

# 3. Status-Update Timestamp Display

## Error / Symptom

Workflow timestamps were displaying correctly, but status-update
timestamps were displaying an incorrect time.

## Investigation

Database inspection showed that `status_updates.created_at` was stored
correctly in IST.

The active backend route serializes the timestamp using
`.toISOString()`.

A global timezone change was deliberately avoided because the workflow
timestamp display was already correct.

## Root Cause

The problem was isolated to the page-level display of status-update
timestamps.

## Change Made

A frontend-only correction was applied to the status-update page.

Global timezone handling and business-day calculations were left
unchanged.

## Result

Status-update timestamps now display correctly without disturbing the
existing workflow timestamp behavior.

## Validation

The corrected display was tested successfully.

------------------------------------------------------------------------

# 4. Full Requisition Item Description Display

## Error / Symptom

Long requisition item descriptions and remarks were being visually
truncated.

## Change Made

The item table was changed to allow wrapping:

``` tsx
<TableCell className="text-muted-foreground text-xs whitespace-normal break-words">
  {item.description ?? "—"}
</TableCell>

<TableCell className="text-muted-foreground text-xs whitespace-normal break-words">
  {item.remark ?? "—"}
</TableCell>
```

## Result

Full description and remark text is now visible and wraps vertically.

## Validation

Manual testing confirmed the change works.

------------------------------------------------------------------------

# 5. Completed Requisition Download System

## Requirement

Completed requisitions must be downloadable by authorized purchasing
users.

The download must contain requisition information and associated files.

## Access Rules

Only:

-   `purchase_member`
-   `purchase_head`

may download a requisition.

The requisition must also have:

``` text
status = completed
```

Incomplete requisitions cannot be downloaded.

## Backend Route

A dedicated endpoint was implemented:

``` text
GET /requisitions/:id/download
```

The route validates the requisition, user role, completed status, and
associated data.

It gathers:

-   requisition details
-   requisition items
-   workflow/status updates
-   approval notes
-   queries
-   query replies
-   requisition attachments
-   query-reply attachments

## Attachment Handling

Actual uploaded files are included rather than only metadata.

The existing:

``` text
uploads/
```

directory is used.

Attachment records use:

``` text
filename
original_name
```

The original attachment name is retained for archive output.

------------------------------------------------------------------------

# 6. Download Format Investigation

## Initial CSV Design

The first design generated a large CSV containing all requisition
information.

This was difficult to print because the spreadsheet became extremely
wide.

## Separate CSV Design

The design was then split into:

``` text
Requisition.csv
Items.csv
Workflow.csv
```

This improved organization but still depended on spreadsheet column
widths.

## Final Decision

PDF was selected as the printable document format.

The final archive structure is:

``` text
REQ-XXXX/
├── Requisition.pdf
└── attachments/
    ├── quotation.pdf
    ├── photo.jpg
    └── ...
```

CSV files were removed from the final download design.

------------------------------------------------------------------------

# 7. Requisition PDF Design

## PDF Requirements

The PDF is intended for A4 printing.

### Requisition Details

Two-column:

``` text
Field | Value
```

layout.

### Items

The item section includes:

-   Item ID
-   Item Name
-   Asset
-   Reference
-   Quantity
-   Unit
-   Expected Cost
-   Description
-   Remark

Long Description and Remark values must wrap vertically.

### Workflow

The workflow section includes:

-   Stage
-   Person
-   Status
-   Suggestion
-   Reviewed At

Timestamps are kept exactly as supplied by the application.

## Dependencies

PDF generation uses PDFKit.

Added:

``` text
pdfkit
@types/pdfkit
```

The API server typecheck passed after the PDF implementation.

------------------------------------------------------------------------

# 8. PDF Issues Found During Testing

The first generated PDF exposed three layout problems.

## 8.1 Requisition Details Column Drift

The field table used the current PDF cursor position as the starting X
coordinate for each row.

After `doc.text(...)`, the cursor moved, causing later rows to drift
diagonally.

### Required correction

Each row must explicitly start from the page's left margin, and the X
position should be reset after table rows.

------------------------------------------------------------------------

## 8.2 Item Page-Break Handling

The first item implementation reserved a fixed amount of space before
each item.

This was insufficient for long descriptions and remarks.

### Required correction

Page-space checks must happen at the row/content level.

Long fields must be able to wrap and continue correctly across pages.

------------------------------------------------------------------------

## 8.3 Footer Created Extra Pages

The first footer was positioned below the PDFKit usable bottom margin.

PDFKit therefore created additional footer-only pages.

### Required correction

The footer must be positioned inside the usable bottom margin.

The footer Y position should be calculated from:

``` ts
doc.page.margins.bottom
```

and must not trigger an automatic page break.

## PDF Status

The PDF download architecture is implemented, but the first generated
PDF identified layout fixes that should be completed before the PDF
layout is considered final.

------------------------------------------------------------------------

# 9. Approver Priority Change

## Requirement

Site Users continue choosing Priority when creating a requisition.

That existing behavior must remain unchanged.

When a requisition reaches the Approver stage, authorized users can
change its priority.

This is a dedicated priority operation and does not grant general
requisition editing permissions.

## Allowed Roles

The final ReqFlow role model uses:

-   `approver`
-   `purchase_head`

There is no separate `admin` role in this application role model.
Purchase Head is the administrative purchasing role.

## Backend Endpoint

A dedicated endpoint was added:

``` text
PATCH /requisitions/:id/priority
```

Accepted values:

``` text
low
medium
high
urgent
```

The endpoint validates:

1.  Requisition ID.
2.  Priority value.
3.  Requisition existence.
4.  User authorization.
5.  Current status.

Priority can only be changed while:

``` text
pending_approver
```

## Authorization

Final permission model:

``` text
Purchase Head
    → can change priority on pending-approver requisitions

Assigned Approver
    → can change priority on their pending-approver requisition

Other Approver
    → cannot

Other users
    → cannot
```

The backend updates:

``` text
priority
updated_at
```

and returns the updated requisition.

------------------------------------------------------------------------

# 10. Priority Frontend

## Button

The button is shown only when:

``` tsx
req.status === "pending_approver"
```

and the user is either the Purchase Head or the assigned Approver.

The final condition is:

``` tsx
{req.status === "pending_approver" &&
  (user.role === "purchase_head" ||
    (user.role === "approver" && req.approver_id === user.id)) && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      setNewPriority(req.priority);
      setPriorityOpen(true);
    }}
    data-testid="button-change-priority"
  >
    Change Priority
  </Button>
)}
```

## Dialog Bug

The priority dialog was initially placed inside the `isApprover`
conditional.

This meant:

``` text
Assigned Approver
    → isApprover = true
    → dialog rendered
    → button worked

Purchase Head
    → isApprover = false
    → dialog not rendered
    → button appeared but did nothing
```

## Fix

The priority dialog was moved outside the `isApprover` conditional.

Approver-specific approval and hold dialogs remain restricted to the
Approver logic.

## Validation

The feature was tested successfully for:

-   assigned Approver
-   Purchase Head
-   opening the dialog
-   changing priority
-   cancelling
-   refreshing the displayed priority

The requisition frontend typecheck passed.

The API server typecheck passed after the backend endpoint was added.

------------------------------------------------------------------------

# 11. Production Data Correction --- Wrong Project

## Incident

Multiple requisitions were created under the wrong project.

They showed:

``` text
Kalughat
```

but were intended for:

``` text
Digha Majuhua
```

## Project IDs Confirmed

Production project records confirmed:

``` text
Digha Majuhua  → 1
Gazipur        → 2
Kalughat       → 3
Guwahati       → 4
Dhubri         → 5
Jogighopa      → 6
Yogayatan Port → 7
Goa Ship Yard  → 8
VOC Port       → 9
Salal Dam      → 10
```

## Affected Requisitions

The identified 16 requisitions were:

``` text
REQ-20260903-0032
REQ-20260902-0030
REQ-20260902-0028
REQ-20260902-0027
REQ-20260902-0026
REQ-20260901-0023
REQ-20260901-0021
REQ-20260901-0017
REQ-20260901-0016
REQ-20260831-0015
REQ-20260831-0013
REQ-20260831-0011
REQ-20260831-0010
REQ-20260831-0009
REQ-20260830-0006
REQ-20260830-0005
```

Verification confirmed all 16 currently had:

``` text
project_id = 3
```

which corresponds to Kalughat.

## Safe Correction

The intended change is:

``` text
project_id 3
    ↓
project_id 1
```

The correction is designed to be performed inside a transaction and
restricted by:

``` sql
AND project_id = 3
```

This prevents a separately corrected requisition from being
unintentionally modified.

## Status

The affected rows and project IDs were verified.

The data correction should be recorded as complete only after the
transaction is committed and final verification confirms that all 16
requisitions belong to Digha Majuhua.

------------------------------------------------------------------------

# 12. Git and Deployment Handling

## Development Environment

Laptop:

``` text
D:\Projectseqflow
```

Production ServerPC:

``` text
D:eqflow
```

## Authentication File

The laptop's:

``` text
artifacts/api-server/src/routes/auth.ts
```

is intended to be committed to GitHub.

The ServerPC has server-specific local authentication changes that must
remain local.

Therefore production deployment must not overwrite the ServerPC
`auth.ts`.

## Deployment Model

Laptop:

``` text
auth.ts
requisitions.ts
RequisitionDetail.tsx
        ↓
      GitHub
```

ServerPC:

``` text
fetch origin/main
        ↓
selectively deploy application files
        ↓
preserve local auth.ts
```

The safer production procedure is:

``` powershell
git fetch origin main
```

followed by selective checkout/deployment of the intended files instead
of blindly running a full pull when local ServerPC state must be
preserved.

------------------------------------------------------------------------

# 13. Validation Summary

  Area                                       Status
  ------------------------------------------ -----------------------------
  Purchase Member visibility                 PASS
  Status-update timestamp display            PASS
  Full description display                   PASS
  Completed requisition download             IMPLEMENTED
  Attachment inclusion                       IMPLEMENTED
  PDF generation                             IMPLEMENTED
  PDF layout                                 FINAL LAYOUT FIXES REQUIRED
  Assigned Approver priority change          PASS
  Purchase Head priority change              PASS
  Priority dialog                            PASS
  API server typecheck                       PASS
  Requisition frontend typecheck             PASS
  Wrong-project requisition identification   PASS
  Wrong-project database correction          VERIFY AFTER COMMIT

------------------------------------------------------------------------

# 14. Database Schema

No new database schema was required for these application features.

Priority uses existing requisition fields.

The download system uses existing requisition, item, workflow, query,
attachment, and upload systems.

The project correction changes existing `project_id` values only.

------------------------------------------------------------------------

# 15. Final Architecture

``` text
                    REQFLOW
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   Requisition      Workflow       Attachments
      Detail
        │
        ├── Priority
        │      ├── Site User selects at creation
        │      ├── Assigned Approver can change
        │      └── Purchase Head can change
        │
        ├── Item display
        │      └── Full description / remark
        │
        ├── Status updates
        │      └── Correct page-level display
        │
        └── Completed download
               ├── Requisition.pdf
               └── attachments/
```

------------------------------------------------------------------------

# 16. Outstanding Work

### PDF

Complete the remaining PDF layout fixes:

-   field-table X-position drift
-   item-level page breaks
-   footer placement / extra pages

### Deployment

After final local validation:

1.  Commit intended laptop changes.
2.  Push to GitHub.
3.  Fetch on ServerPC.
4.  Selectively deploy intended application files.
5.  Preserve ServerPC-specific `auth.ts`.
6.  Install required dependencies if needed.
7.  Typecheck/build.
8.  Restart production only after verification.

### Project Correction

Confirm the 16 affected requisitions have been committed to:

``` text
Digha Majuhua
```

and verify the final project values.

------------------------------------------------------------------------

# 17. Continuation Note

This document continues:

``` text
DEBUG_LOG_TYPECHECK_FIXES.md
```

The earlier log covered the major typecheck, API contract,
generated-client, Zod resolver, legacy-route, and session-secret work.

This continuation records the subsequent functional changes,
document/download work, priority workflow, and production-data handling.

The purpose is to preserve both:

``` text
What changed
```

and:

``` text
Why it changed
```

so future maintenance can distinguish intentional behavior from bugs or
obsolete implementation.
