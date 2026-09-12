import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { prisma } from "./db/connect.js";
import { hashPassword } from "./auth/password.js";
import type { UserRole } from "@prisma/client";

if (process.env.NODE_ENV === "production") throw new Error("Demo accounts cannot be seeded in production.");
const output = ".demo-accounts.json";
const accounts: { email: string; name: string; role: UserRole }[] = [
  { email: "member@isanpower.test", name: "Theewasu A.", role: "member" },
  { email: "ta@isanpower.test", name: "Kantee L.", role: "ta" },
  { email: "ta2@isanpower.test", name: "Tanon L.", role: "ta" },
  { email: "manager@isanpower.test", name: "Lab Manager", role: "lab_manager" },
];
try {
  if (existsSync(output)) throw new Error(`${output} already exists. Existing credentials are preserved; open that file to sign in.`);
  if (await prisma.user.count({ where: { email: { in: accounts.map((a) => a.email) } } })) {
    throw new Error("Demo accounts already exist. No passwords or roles were changed.");
  }
  const credentials = await Promise.all(accounts.map(async (account) => {
    const password = randomBytes(18).toString("base64url");
    return { ...account, password, passwordHash: await hashPassword(password) };
  }));
  await prisma.$transaction(credentials.map(({ password: _password, ...data }) => prisma.user.create({ data })));
  writeFileSync(output, JSON.stringify(credentials.map(({ passwordHash: _hash, ...account }) => account), null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Created four local demo accounts. Open apps/api/${output} for credentials. Do not commit this file.`);
} finally { await prisma.$disconnect(); }
