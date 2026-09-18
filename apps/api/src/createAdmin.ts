import "dotenv/config";
import { z } from "zod";
import { prisma } from "./db/connect.js";
import { hashPassword } from "./auth/password.js";

// Explicit bootstrap command: never silently promote or overwrite an existing account.
try {
  const input = z.object({ email: z.email().toLowerCase(), name: z.string().trim().min(1).max(100), password: z.string().min(12).max(256) }).safeParse({
    email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME, password: process.env.ADMIN_PASSWORD,
  });
  if (!input.success) throw new Error("Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (12+ characters).");
  const { password, ...data } = input.data;
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new Error("Account already exists; no changes made.");
  await prisma.user.create({ data: { ...data, role: "admin", membershipStatus: "APPROVED", passwordHash: await hashPassword(password) } });
  console.log("Administrator created. Sign in at /login.");
} finally { await prisma.$disconnect(); }
