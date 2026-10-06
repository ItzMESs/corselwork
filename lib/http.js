import { isAdmin } from "./auth.js";

export class HttpError extends Error {
  constructor(status, message){ super(message); this.status = status; }
}

// Wraps a handler: method routing, admin guard, JSON errors.
export function route(methods){
  return async (req, res) => {
    try {
      const h = methods[req.method];
      if (!h) throw new HttpError(405, "Method not allowed");
      if (h.admin && !isAdmin(req)) throw new HttpError(401, "Нэвтрэх шаардлагатай");
      await (h.fn || h)(req, res);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      res.status(e.status || 500).json({ error: e instanceof HttpError ? e.message : "Серверийн алдаа" });
    }
  };
}
export const admin = fn => ({ admin: true, fn });

export const body = req => (req.body && typeof req.body === "object") ? req.body : {};

export function int(v, name){
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, `${name} буруу байна`);
  return n;
}
export function str(v, name, { max = 500, required = false } = {}){
  const s = String(v ?? "").trim();
  if (required && !s) throw new HttpError(400, `${name} хоосон байна`);
  if (s.length > max) throw new HttpError(400, `${name} хэт урт байна`);
  return s;
}
