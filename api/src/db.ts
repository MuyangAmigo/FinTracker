import { PrismaClient } from "@prisma/client";
export const db = new PrismaClient();
export const householdId = () => process.env.HOUSEHOLD_ID ?? "household";
