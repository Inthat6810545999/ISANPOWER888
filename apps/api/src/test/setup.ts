import { execSync } from "node:child_process";
import { afterAll, afterEach, beforeAll } from "vitest";
import { prisma } from "../db/connect.js";

beforeAll(() => {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
});

afterEach(async () => {
  await prisma.labRequest.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});