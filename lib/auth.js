import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(){
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD is not set");
  return s;
}
const sign = exp => createHmac("sha256", secret()).update("admin:" + exp).digest("hex");

function safeEqual(a, b){
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export const checkPassword = pw => safeEqual(pw || "", secret());

export function sessionCookie(){
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isAdmin(req){
  const raw = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [exp, mac] = raw.slice(COOKIE.length + 1).split(".");
  return +exp > Date.now() / 1000 && safeEqual(mac, sign(exp));
}
