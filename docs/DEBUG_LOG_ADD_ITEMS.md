# ReqFlow — Debug / Change Log
## Feature: Add Line Items While Editing a Requisition

**Date:** 25 August 2026  
**Status:** COMPLETE and tested locally
**Developer:** Shashank Singh Parihar
---

## 1. Original Requirement

The requisition detail page allowed existing line items to be edited, but there was no way to add additional line items after a requisition had been created.

Required workflow:

1. Open an existing requisition.
2. Click **Edit**.
3. Modify existing items.
4. Click **+ Add Another Item** to create additional items.
5. Fill in the new item.
6. Save all changes together.
7. Existing items must be updated.
8. New items must be created.
9. The edit dialog must close after successful saving.
10. Newly added items must retain their order.

---

## 2. Files Changed

### Frontend

`artifacts/requisition/src/pages/RequisitionDetail.tsx`

Changes:
- Imported `useAddRequisitionItem`.
- Added `addItemMut`.
- Added `tempId` to edit-item state.
- Changed edit-row identification to use `tempId`.
- Added `addNewEditItem()`.
- Added **+ Add Another Item**.
- Changed save logic to distinguish existing and new items.
- Changed saving to `mutateAsync()` + `Promise.all()`.
- Dialog closes only after all saves succeed.

### Backend

`artifacts/api-server/src/routes/requisitions.ts`

Changes:
- Fixed the POST item handler so `quantity` is included in the INSERT.
- Added automatic `sort_order` calculation for newly inserted items.

No existing database records were migrated or rewritten.

---

## 3. API Endpoints

Existing API endpoints used by the feature:

```text
GET    /requisitions/{id}/items
POST   /requisitions/{id}/items
PATCH  /requisitions/{id}/items/{itemId}
DELETE /requisitions/{id}/items/{itemId}
```

`POST` creates a new item; `PATCH` updates an existing item.

---

## 4. Temporary ID Design

A new item does not have a database ID yet.

The frontend creates a temporary identifier:

```tsx
tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
```

This ID exists only in React state and is never sent to the database.

Conceptually:

```text
Existing:
id = 42
tempId = existing-42

New:
id = 0
tempId = new-...
```

When the new item is saved, the POST endpoint creates its real database ID.

The `tempId` does not become the database ID; it is only a frontend row identifier.

---

## 5. Why We Use Temporary Items

Clicking **+ Add Another Item** does NOT immediately create a database record.

Instead:

```text
+ Add Another Item
        ↓
Create temporary row in browser state
        ↓
User fills fields
        ↓
Save Changes
        ↓
POST new item
```

This prevents abandoned blank database records if the user cancels the edit.

---

## 6. Existing vs New Items

The save logic uses the database `id` to determine the operation:

```tsx
if (it.id > 0) {
  // Existing item → PATCH
} else {
  // New item → POST
}
```

Existing:

```text
id = 42
PATCH /requisitions/1/items/42
```

New:

```text
id = 0
POST /requisitions/1/items
```

This allows existing and newly added items to be saved in one operation.

---

## 7. Final Save Logic

The final implementation uses React Query's `mutateAsync()`:

```tsx
await Promise.all(
  editItems.map((it) => {
    if (it.id > 0) {
      return updateItemMut.mutateAsync({
        id,
        itemId: it.id,
        data,
      });
    }

    return addItemMut.mutateAsync({
      id,
      data,
    });
  })
);
```

Why this approach was chosen:

The earlier implementation manually wrapped `mutate()` callbacks in Promises. Although the API requests succeeded, the edit dialog did not close reliably.

`mutateAsync()` returns a real Promise, so `Promise.all()` can reliably wait for all item operations.

After success:

```tsx
setEditOpen(false);
```

The dialog closes.

If any operation fails, the error is caught and the dialog remains open.

---

## 8. Backend Bug Found During Testing

The first attempt to create a new item returned:

```text
POST /api/requisitions/1/items → 500
```

The database error showed that `quantity` was being inserted as the database default instead of the submitted value.

The POST handler already extracted and validated `quantity`:

```tsx
const { item_name, quantity, ... } = req.body;

if (!item_name || quantity == null) {
  ...
}
```

However, the INSERT did not include `quantity`.

### Fix

The INSERT now contains:

```tsx
quantity: String(quantity),
```

This matches the existing PATCH implementation, which also stores quantity as a string.

---

## 9. Item Ordering

New items originally used:

```tsx
sort_order: sort_order ?? 0
```

Therefore multiple newly created items could all receive `sort_order = 0`, making their relative order unreliable.

### Final solution

When creating a new item, the backend reads the existing sort orders for that requisition and calculates:

```text
highest existing sort_order + 1
```

The logic is:

```tsx
const existingItems = await db
  .select({ sort_order: requisitionItemsTable.sort_order })
  .from(requisitionItemsTable)
  .where(eq(requisitionItemsTable.requisition_id, id));

const nextSortOrder =
  existingItems.length > 0
    ? Math.max(...existingItems.map((item) => item.sort_order ?? 0)) + 1
    : 0;
```

The INSERT uses:

```tsx
sort_order: sort_order ?? nextSortOrder,
```

### Database safety decision

We deliberately did NOT modify existing records to correct historical ordering.

No migration, bulk update, delete/reinsert, or rewriting of existing requisition items was performed.

Only newly inserted items receive the calculated next position.

---

## 10. Expected Ordering for New Requisitions

For a clean new requisition:

```text
Item 1 → 0
Item 2 → 1
Item 3 → 2
```

Later, during Edit:

```text
Item 4 → 3
Item 5 → 4
```

The GET endpoint already orders by `sort_order`, so the sequence is preserved.

---

## 11. Testing Performed

### Existing item editing

Confirmed existing items continue to update successfully:

```text
PATCH /api/requisitions/1/items/1 → 200
PATCH /api/requisitions/1/items/2 → 200
```

### New item creation

Initially:

```text
POST /api/requisitions/1/items → 500
```

Root cause was the missing `quantity` field in the backend INSERT.

After adding:

```tsx
quantity: String(quantity),
```

new items were successfully created.

### Multiple items

Tested a mixture of existing and new items.

Expected behavior:

```text
Existing → PATCH
Existing → PATCH
New      → POST
New      → POST
```

### Dialog closing

The save implementation was changed to `mutateAsync()` and `Promise.all()`.

After all operations succeed:

```text
Save → wait for all → close dialog
```

### Ordering

Newly inserted items now receive sequential `sort_order` values.

---

## 12. Local Development Notes

The local API currently generates a random session secret when `SESSION_SECRET` is not configured.

After an API restart, the browser may therefore need to log in again.

During API restart, Vite may temporarily show:

```text
ECONNREFUSED
```

for `/api/...` requests because the API server has not started listening yet.

Once the API is listening on port 8080, requests work normally.

---

## 13. Final Architecture

```text
                 REQUISITION EDIT
                       │
                       ▼
              Load existing items
                       │
             ┌─────────┴─────────┐
             │                   │
        Existing item        + Add Item
             │                   │
        database ID           tempId
             │                   │
             │             blank frontend row
             │                   │
             └─────────┬─────────┘
                       │
                  User edits
                       │
                       ▼
                 Save Changes
                       │
             ┌─────────┴─────────┐
             │                   │
          id > 0              id = 0
             │                   │
           PATCH                POST
             │                   │
             └─────────┬─────────┘
                       │
                Promise.all()
                       │
                       ▼
                All successful
                       │
                       ▼
                 Close dialog
```

---

## 14. Current Status

**Feature: Add Line Items During Edit**

**COMPLETE**

The workflow has been tested locally.

The next planned ReqFlow feature is:

**Save as Draft**
