// Vercel build: find the database URL (the Prisma Postgres integration may name it differently),
// then generate the client and sync the schema. db push only manages the app's own "corsel"
// schema (see lib/db-url.js) and is never run with --accept-data-loss.
import { execSync } from "node:child_process";
import { dbUrl } from "../lib/db-url.js";

const url = dbUrl();
if (!url) {
  console.error("\n✖ DATABASE_URL олдсонгүй.\n" +
    "  Vercel → Project → Storage → Prisma Postgres → Connect хийгээд дахин Redeploy хийнэ үү.\n" +
    "  Олдсон хувьсагчид: " + (Object.keys(process.env).filter(k => /URL|POSTGRES|DATABASE/i.test(k)).join(", ") || "(байхгүй)") + "\n");
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: url };
execSync("npx prisma generate", { stdio: "inherit", env });
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
