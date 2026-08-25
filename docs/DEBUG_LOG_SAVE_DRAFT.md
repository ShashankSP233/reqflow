# ReqFlow — Debug Log
## Feature: Save as Draft

**Date:** 25 August 2026

**Status:** COMPLETE and tested locally

**Developer:** Shashank Singh Parihar

---

## 1. Requirement

Users creating requisitions frequently need to leave the ReqFlow page to check specifications, references, quantities, or other information before adding the next item.

Previously, form data existed only in the active frontend state. If the page was refreshed or the application state was lost, the user's progress could be cleared.

The requirement was to provide a **manual Save as Draft** function that allows the user to save their current progress before leaving the page.

---

## 2. Intended Workflow

1. User starts a new requisition.
2. User enters requisition details.
3. User adds one or more line items.
4. User clicks **Save as Draft**.
5. The current form state is stored locally in the browser.
6. User can leave the page to gather additional information.
7. User returns to the Create Requisition page.
8. The previously saved information is automatically restored.
9. User continues adding or editing information.
10. User clicks **Save as Draft** again when another recovery point is required.
11. The new saved state replaces the previous saved state.
12. When the requisition is eventually created successfully, the saved local draft can be cleared.

---

## 3. Important Design Decision

The Save as Draft feature is a **local form recovery mechanism**.

It does **not** create a requisition in the database.

This distinction is important because ReqFlow already has a database-level `draft` status for actual requisitions. The Save as Draft feature described in this document is different.

### Browser Draft

Used while the user is still preparing a requisition.

```text
User Form
    ↓
Save as Draft
    ↓
Browser localStorage
```

### Database Requisition

Created only when the user completes the actual requisition creation process.

```text
Completed Form
    ↓
Create Requisition
    ↓
API
    ↓
Database
```

---

## 4. Why the Feature Was Required

The main problem was loss of user work.

A typical user workflow is:

```text
Start requisition
      ↓
Add Item 1
      ↓
Save as Draft
      ↓
Leave ReqFlow
      ↓
Check specifications for Item 2
      ↓
Return to ReqFlow
      ↓
Continue requisition
```

Without a persistent draft, users could lose previously entered information after a page refresh or loss of the active frontend state.

The Save as Draft feature provides a manual recovery point.

---

## 5. Storage Method

The draft is stored using browser `localStorage`.

The storage key used is:

```text
reqflow:create-requisition-draft
```

The general flow is:

```text
React Hook Form
      ↓
form.getValues()
      ↓
JSON.stringify()
      ↓
localStorage
```

Because the complete form state is stored, the draft can contain both requisition information and line items.

---

## 6. Form State

The Create Requisition page uses React Hook Form.

The current form state is obtained using:

```ts
form.getValues()
```

The saved state contains the current values of the requisition form, including the line item array.

Conceptually:

```text
{
    requisition fields,
    items: [
        item 1,
        item 2,
        item 3
    ]
}
```

This means the draft does not need a separate storage mechanism for each individual field or item.

---

## 7. Line Items

Line items are already part of the Create Requisition form state.

Therefore, when the draft is saved, the current line items are saved together with the rest of the form.

For example:

```text
Draft
├── Requisition details
├── Item 1
├── Item 2
└── Item 3
```

No separate database records are created for these items when Save as Draft is clicked.

---

## 8. Restoring the Draft

When `CreateRequisition.tsx` loads, the application checks whether a saved draft exists in `localStorage`.

If a draft exists, it is parsed and passed back into the React Hook Form state.

The restoration flow is:

```text
localStorage
      ↓
JSON.parse()
      ↓
form.reset(draft)
      ↓
Form restored
```

The saved draft is automatically restored.

The user is **not** shown a "Restore Draft?" confirmation dialog.

---

## 9. Automatic Restoration

The intended behavior is similar to the recovery experience of common online forms.

For example:

```text
User saves draft
      ↓
Leaves page
      ↓
Browser/page is refreshed
      ↓
Create Requisition loads
      ↓
Saved draft is detected
      ↓
Form is automatically populated
```

This prevents the user from having to manually reconstruct their previous work.

---

## 10. Manual Save Only

The feature is intentionally **manual**.

There is no automatic save timer.

The user decides when to create a recovery point by clicking:

**Save as Draft**

For example:

```text
Add Item 1
      ↓
Save as Draft
      ↓
Research Item 2
      ↓
Return
      ↓
Add Item 2
      ↓
Save as Draft
```

This keeps the behavior predictable and avoids unnecessary background writes.

---

## 11. Draft Replacement

Only the latest saved draft is retained.

Every time the user clicks **Save as Draft**, the existing local draft is overwritten.

Example:

```text
First Save
    ↓
Item 1

Second Save
    ↓
Item 1 + Item 2

Third Save
    ↓
Item 1 + Item 2 + Item 3
```

The third save becomes the current draft.

There is no version history for local drafts.

---

## 12. Partially Completed Forms

Save as Draft does not use the normal requisition submission process.

The current form values are read directly using:

```ts
form.getValues()
```

This means the user can save incomplete work.

For example:

```text
Project: selected
Site: selected
Purpose: incomplete
Item 1: completed
Item 2: partially completed
```

The user can still save this state as a draft.

Normal form validation remains applicable when the user actually creates the requisition.

---

## 13. Validation Behavior

The Save as Draft operation intentionally does not require the complete requisition to pass normal submission validation.

This is because the purpose of Save as Draft is to preserve unfinished work.

The normal Create Requisition action continues to use the existing validation and submission process.

Therefore:

```text
Save as Draft
    ↓
Save current state
    ↓
No normal submission validation required
```

while:

```text
Create Requisition
    ↓
Normal validation
    ↓
API submission
```

---

## 14. Database Impact

Save as Draft does **not** modify the database.

It does not create a new requisition.

It does not create requisition items.

It does not call the requisition creation API.

The database remains unchanged until the user actually creates the requisition.

This was intentionally designed to avoid unnecessary database records for unfinished forms.

---

## 15. API Impact

No new API endpoint is required for the local draft functionality.

The Save as Draft operation happens entirely in the frontend.

The existing requisition API remains responsible for the actual creation of requisitions.

The architecture is therefore:

```text
Save as Draft
      ↓
Frontend
      ↓
localStorage
```

instead of:

```text
Save as Draft
      ↓
Frontend
      ↓
API
      ↓
Database
```

---

## 16. Browser Persistence

`localStorage` is persistent browser storage.

Under normal conditions, the saved draft survives:

- Page refresh
- Navigation to another page
- Closing the tab
- Closing the browser
- Restarting the computer
- Shutting down the computer

Therefore, if the user saves their work before leaving ReqFlow, the draft can still be available when they return.

The draft can be lost if the browser/site storage is explicitly cleared or otherwise removed.

---

## 17. Attachments

Pending attachment files require separate handling because browser `File` objects cannot simply be serialized into `localStorage` as normal form data.

The current Save as Draft implementation therefore focuses on the requisition form state and line item information.

Actual file persistence should be treated as a separate feature if required.

---

## 18. Testing

The Save as Draft functionality was tested locally.

### Test 1 — Basic Save

A requisition was partially filled and Save as Draft was clicked.

**Result: PASS**

The draft was successfully stored locally.

### Test 2 — Form Restoration

The page was refreshed after saving the draft.

**Result: PASS**

Previously saved form information was automatically restored.

### Test 3 — Line Item Restoration

Line items were added before saving the draft.

**Result: PASS**

The saved line items were restored together with the rest of the form.

### Test 4 — Navigation

The user navigated away from the Create Requisition page after saving.

The page was then opened again.

**Result: PASS**

The saved form data was restored.

### Test 5 — Draft Replacement

A draft was saved.

Additional information was entered.

Save as Draft was clicked again.

**Result: PASS**

The latest saved state replaced the previous draft.

### Test 6 — Clearing the Draft

The local draft was removed from browser storage.

**Result: PASS**

The Create Requisition page returned to its normal initial state.

### Test 7 — Dropdown/Form Values

Draft restoration was tested with normal form values.

Regular form fields were restored successfully.

Dropdown fields use their underlying stored values and therefore require the corresponding option to be available when the form is rendered.

**Result: PASS**

The underlying form restoration mechanism works correctly.

---

## 19. Files Changed

The primary frontend file modified for this feature is:

```text
artifacts/requisition/src/pages/CreateRequisition.tsx
```

The implementation was kept within the frontend and did not require changes to the requisition API or database.

---

## 20. Implementation Summary

The feature consists of three main parts.

### Draft Key

A fixed local storage key identifies the current Create Requisition draft:

```text
reqflow:create-requisition-draft
```

### Save

The current form state is obtained with:

```ts
form.getValues()
```

and stored as JSON.

### Restore

When the page loads, the stored JSON is parsed and restored using:

```ts
form.reset(draft)
```

---

## 21. Final Workflow

The completed workflow is:

```text
                 CREATE REQUISITION
                         │
                         ▼
                  Fill form/items
                         │
                         ▼
                  Save as Draft
                         │
                         ▼
                    localStorage
                         │
              ┌──────────┴──────────┐
              │                     │
         Leave page              Refresh
              │                     │
              └──────────┬──────────┘
                         ▼
                Return to form
                         │
                         ▼
                Automatic restore
                         │
                         ▼
                Continue working
                         │
                         ▼
                  Save as Draft
                         │
                         ▼
                Latest draft replaces
                  previous draft
                         │
                         ▼
              Create Requisition
                         │
                         ▼
                    Database
```

---

## 22. Current Status

**SAVE AS DRAFT — COMPLETE AND TESTED LOCALLY**

The feature currently provides a manual local recovery mechanism for unfinished Create Requisition forms.

It does not create database records and does not modify the existing requisition API or database structure.
