import { PrismaClient } from "@prisma/client";

/*
 * Prisma client singleton.
 *
 * Next.js dev mode reloads modules on every change, which would create a new
 * PrismaClient (and a new connection pool) per HMR cycle if we just exported
 * a fresh instance. The standard fix is to stash the instance on globalThis.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
