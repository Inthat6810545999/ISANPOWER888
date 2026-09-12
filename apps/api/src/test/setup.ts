import { execSync } from "node:child_process";
import { afterAll, afterEach, beforeAll } from "vitest";
import { prisma } from "../db/connect.js";

// This suite deletes records. Fail before migrations/cleanup on a non-test database.
const testDatabase = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/missing");
if (!testDatabase.pathname.endsWith("_test")) {
  throw new Error("Tests require a dedicated DATABASE_URL with a database name ending in _test");
}

beforeAll(() => {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
});

afterEach(async () => {
  await prisma.labRequest.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
