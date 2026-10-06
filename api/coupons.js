import { prisma } from "../lib/db.js";
import { isAdmin } from "../lib/auth.js";
import { admin, body, int, route, str, HttpError } from "../lib/http.js";

const norm = c => String(c || "").trim().toUpperCase();

export default route({
  // ?code=X → public check of one active coupon; without code → full list (admin only).
  GET: async (req, res) => {
    if (req.query.code !== undefined) {
      const c = await prisma.coupon.findUnique({ where: { code: norm(req.query.code) } });
      if (!c?.active) throw new HttpError(404, "Купон код буруу байна");
      return res.json({ code: c.code, percent: c.percent });
    }
    if (!isAdmin(req)) throw new HttpError(401, "Нэвтрэх шаардлагатай");
    res.json(await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }));
  },
  POST: admin(async (req, res) => {
    const b = body(req);
    const code = norm(str(b.code, "Код", { max: 20, required: true }));
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new HttpError(400, "Код 3-20 тэмдэгт (A-Z, 0-9) байна");
    const percent = int(b.percent, "Хувь");
    if (percent < 1 || percent > 100) throw new HttpError(400, "Хувь 1-100 байна");
    if (await prisma.coupon.findUnique({ where: { code } })) throw new HttpError(409, "Ийм код аль хэдийн байна");
    res.status(201).json(await prisma.coupon.create({ data: { code, percent } }));
  }),
  PATCH: admin(async (req, res) => {
    const c = await prisma.coupon.update({ where: { code: norm(req.query.code) }, data: { active: !!body(req).active } })
      .catch(e => { throw e.code === "P2025" ? new HttpError(404, "Купон олдсонгүй") : e; });
    res.json(c);
  }),
  DELETE: admin(async (req, res) => {
    await prisma.coupon.deleteMany({ where: { code: norm(req.query.code) } });
    res.json({ ok: true });
  }),
});
