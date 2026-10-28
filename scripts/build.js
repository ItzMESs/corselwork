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

// The live site holds database connections too; if the limit is momentarily full, wait and retry.
const wait = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
for (let attempt = 1; ; attempt++) {
  try {
    execSync("npx prisma db push --skip-generate", { stdio: ["inherit", "inherit", "pipe"], env, encoding: "utf8" });
    break;
  } catch (e) {
    const msg = String(e.stderr || "");
    process.stderr.write(msg);
    if (attempt >= 5 || !/too many connections|P1001|P1017|timed out/i.test(msg)) throw e;
    console.log(`\nӨгөгдлийн сан завгүй байна, ${attempt * 15} секунд хүлээгээд дахин оролдоно (${attempt}/4)…\n`);
    wait(attempt * 15000);
  }
}
