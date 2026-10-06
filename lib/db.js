import { PrismaClient } from "@prisma/client";
import { dbUrl } from "./db-url.js";

// Reuse one client across hot reloads / warm serverless invocations.
const g = globalThis;
export const prisma = g.__prisma || (g.__prisma = new PrismaClient({ datasourceUrl: dbUrl() }));
