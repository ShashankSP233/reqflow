import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Deliberately built on Node's built-in `crypto` module rather than adding
// bcrypt/argon2 as a dependency — those ship native/compiled binaries per
// platform, which is exactly the class of problem that caused the
// esbuild/lightningcss/rollup Windows issues earlier in this project's
// setup. scrypt is a well-regarded, purpose-built password-hashing
// algorithm and needs zero extra packages.

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = scryptSync(password, salt, KEY_LENGTH);
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(hashBuffer, candidateBuffer);
}
