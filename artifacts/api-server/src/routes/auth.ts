import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../lib/auth";
import "../lib/session-types";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { name, password } = req.body;

  console.log("LOGIN DEBUG:", {
    name,
    passwordProvided: !!password,
  });

  if (!name || !password) {
    res.status(400).json({ error: "name and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.name, name));
  console.log("USER DEBUG:", {
    requestedName: name,
    userFound: !!user,
    passwordHashPresent: !!user?.password_hash,
  });
  // Deliberately identical error for "no such user" and "wrong password" —
  // distinguishing them would let someone probe which names have accounts.
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid name or password" });
    return;
  }

  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, role: user.role, site_name: user.site_name });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).send();
  });
});

router.get("/auth/me", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  res.json({ id: user.id, name: user.name, role: user.role, site_name: user.site_name });
});

export default router;
