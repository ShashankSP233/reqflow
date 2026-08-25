import { randomBytes, scryptSync } from "crypto";
import { db, usersTable } from "./index";

// Duplicated from artifacts/api-server/src/lib/auth.ts deliberately —
// lib/db is a lower-level package that api-server depends on, not the
// other way around, so this ~10-line hashing helper is kept self-contained
// here rather than introducing a cross-package dependency for it.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  const name = process.env.SEED_ADMIN_NAME || "Admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe2026";

  const existing = await db.select().from(usersTable);
  if (existing.length > 0) {
    console.log(`users table already has ${existing.length} row(s) — skipping (this only runs against an empty table).`);
    console.log("If you really want to reseed, delete the existing rows first.");
    process.exit(0);
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      role: "purchase_head",
      password_hash: hashPassword(password),
    })
    .returning();

  console.log("Created the first login-capable account:");
  console.log(`  Name:     ${user.name}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     Purchase Head`);
  console.log("\nLog in with these, then use Setup > Users to add everyone else and set their passwords.");
  console.log("(Change this password once logged in — anyone reading this terminal history can see it.)");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
