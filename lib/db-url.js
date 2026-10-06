// Names the Vercel Prisma Postgres integration may use for the connection string.
// Any custom prefix chosen in Vercel (e.g. STORAGE_DATABASE_URL) is matched by the suffix scan.
export function dbUrl(env = process.env){
  const direct = env.DATABASE_URL || env.POSTGRES_URL || env.PRISMA_DATABASE_URL;
  if (direct) return direct;
  const key = Object.keys(env).find(k => /(_DATABASE_URL|_POSTGRES_URL)$/.test(k) && /^(postgres(ql)?|prisma\+postgres):\/\//.test(env[k]));
  return key ? env[key] : undefined;
}
