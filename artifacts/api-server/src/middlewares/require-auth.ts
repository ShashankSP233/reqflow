import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import "../lib/session-types";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    // The account behind this session was deleted — clear it rather than
    // leave the browser holding a cookie for a user that no longer exists.
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  req.currentUser = { id: user.id, name: user.name, role: user.role, site_name: user.site_name };
  next();
}
