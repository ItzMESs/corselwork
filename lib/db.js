import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads / warm serverless invocations.
const g = globalThis;
export const prisma = g.__prisma || (g.__prisma = new PrismaClient());
