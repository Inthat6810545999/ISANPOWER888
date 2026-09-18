import { Prisma } from "@prisma/client";
import { prisma } from "../db/connect.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { GoogleIdentity } from "./google.js";

export async function resolveGoogleAccount(identity: GoogleIdentity) {
  // Unique email and Google subject also protect against concurrent first logins.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const linked = await tx.user.findUnique({ where: { googleSubject: identity.subject } });
        if (linked) {
          if (!linked.active) throw new HttpError(403, "This account is inactive.");
          return linked; // Never overwrite stored email, name, membership, or role at login.
        }
        const existing = await tx.user.findUnique({ where: { email: identity.email } });
        if (existing) {
          if (!existing.active) throw new HttpError(403, "This account is inactive.");
          if (existing.googleSubject || !identity.authoritativeEmail) {
            throw new HttpError(409, "This email already has an account. Contact the lab team to link it securely.");
          }
          const linkedCount = await tx.user.updateMany({ where: { id: existing.id, googleSubject: null }, data: { googleSubject: identity.subject } });
          if (!linkedCount.count) throw new HttpError(409, "Account linking changed. Please sign in again.");
          return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
        }
        return tx.user.create({ data: { googleSubject: identity.subject, email: identity.email, name: identity.name,
          role: "unassigned", membershipStatus: "PENDING" } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt === 0) continue;
      throw error;
    }
  }
  throw new HttpError(409, "Account changed. Please sign in again.");
}
