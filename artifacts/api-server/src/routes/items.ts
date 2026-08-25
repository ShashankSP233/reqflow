import { Router } from "express";
import { db } from "@workspace/db";
import { requisitionItemsTable, requisitionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/requisitions/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const items = await db
    .select()
    .from(requisitionItemsTable)
    .where(eq(requisitionItemsTable.requisition_id, id));
  res.json(items.map(formatItem));
});

router.post("/requisitions/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const { description, quantity, unit, unit_price, supplier, part_number, notes } = req.body;

  if (!description || quantity == null || unit_price == null) {
    res.status(400).json({ error: "description, quantity, and unit_price are required" });
    return;
  }

  const total_price = Number(quantity) * Number(unit_price);

  const [item] = await db
    .insert(requisitionItemsTable)
    .values({
      requisition_id: id,
      description,
      quantity: String(quantity),
      unit: unit ?? null,
      unit_price: String(unit_price),
      total_price: String(total_price),
      supplier: supplier ?? null,
      part_number: part_number ?? null,
      notes: notes ?? null,
    })
    .returning();

  await recalculateTotal(id);

  res.status(201).json(formatItem(item));
});

router.patch("/requisitions/:id/items/:itemId", async (req, res) => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const { description, quantity, unit, unit_price, supplier, part_number, notes } = req.body;

  const existing = await db
    .select()
    .from(requisitionItemsTable)
    .where(and(eq(requisitionItemsTable.id, itemId), eq(requisitionItemsTable.requisition_id, id)))
    .limit(1);

  if (!existing.length) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (description !== undefined) updates.description = description;
  if (quantity !== undefined) updates.quantity = String(quantity);
  if (unit !== undefined) updates.unit = unit;
  if (unit_price !== undefined) updates.unit_price = String(unit_price);
  if (supplier !== undefined) updates.supplier = supplier;
  if (part_number !== undefined) updates.part_number = part_number;
  if (notes !== undefined) updates.notes = notes;

  const newQty = quantity !== undefined ? Number(quantity) : Number(existing[0].quantity);
  const newPrice = unit_price !== undefined ? Number(unit_price) : Number(existing[0].unit_price);
  updates.total_price = String(newQty * newPrice);

  const [updated] = await db
    .update(requisitionItemsTable)
    .set(updates)
    .where(eq(requisitionItemsTable.id, itemId))
    .returning();

  await recalculateTotal(id);

  res.json(formatItem(updated));
});

router.delete("/requisitions/:id/items/:itemId", async (req, res) => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);

  await db.delete(requisitionItemsTable).where(
    and(eq(requisitionItemsTable.id, itemId), eq(requisitionItemsTable.requisition_id, id))
  );

  await recalculateTotal(id);

  res.status(204).send();
});

async function recalculateTotal(requisitionId: number) {
  const result = await db
    .select({ sum: sql<string>`COALESCE(SUM(${requisitionItemsTable.total_price}), 0)` })
    .from(requisitionItemsTable)
    .where(eq(requisitionItemsTable.requisition_id, requisitionId));

  await db
    .update(requisitionsTable)
    .set({ total_amount: result[0].sum, updated_at: new Date() })
    .where(eq(requisitionsTable.id, requisitionId));
}

function formatItem(item: Record<string, unknown>) {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
  };
}

export default router;
