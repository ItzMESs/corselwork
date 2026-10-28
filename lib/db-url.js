// The database may be shared with other projects, so this app keeps its tables in its own
// Postgres schema ("corsel") and never touches tables in "public".
const SCHEMA = "corsel";

// Names the Vercel Prisma Postgres integration may use for the connection string.
// Any custom prefix chosen in Vercel (e.g. STORAGE_DATABASE_URL) is matched by the suffix scan.
function rawUrl(env){
  const direct = env.DATABASE_URL || env.POSTGRES_URL || env.PRISMA_DATABASE_URL;
  if (direct) return direct;
  const key = Object.keys(env).find(k => /(_DATABASE_URL|_POSTGRES_URL)$/.test(k) && /^(postgres(ql)?|prisma\+postgres):\/\//.test(env[k]));
  return key ? env[key] : undefined;
}

export function dbUrl(env = process.env){
  const raw = rawUrl(env);
  if (!raw) return undefined;
  const u = new URL(raw);
  u.searchParams.set("schema", SCHEMA);
  // Serverless: every function instance keeps its own pool, so one connection each keeps the
  // database under its connection limit (otherwise deploys fail with "too many connections").
  if (/^postgres(ql)?:$/.test(u.protocol)) {
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
  }
  return u.toString();
}
