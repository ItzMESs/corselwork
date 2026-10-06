import { prisma } from "../lib/db.js";
import { admin, body, int, route, str, HttpError } from "../lib/http.js";

export default route({
  // Public checkout. Prices and discount are computed here, never trusted from the client.
  POST: async (req, res) => {
    const b = body(req);
    const name = str(b.name, "Нэр", { max: 100, required: true });
    const phone = str(b.phone, "Утас", { max: 30, required: true });
    const address = str(b.address, "Хаяг", { max: 500, required: true });
    if (!/^[0-9+ ]{8,}$/.test(phone)) throw new HttpError(400, "Утасны дугаар буруу байна");

    const wanted = (Array.isArray(b.items) ? b.items : []).slice(0, 50);
    if (!wanted.length) throw new HttpError(400, "Сагс хоосон байна");
    const ids = [...new Set(wanted.map(i => int(i.id, "Бараа")))];
    const products = await prisma.product.findMany({
      where: { id: { in: ids } }, select: { id:true, name:true, price:true, sizes:true, sold:true },
    });

    const items = wanted.map(i => {
      const p = products.find(x => x.id === Number(i.id));
      if (!p) throw new HttpError(400, "Сагсанд байсан бараа устгагдсан байна");
      if (p.sold) throw new HttpError(400, `"${p.name}" дууссан байна`);
      const size = str(i.size, "Хэмжээ", { max: 20 });
      if (p.sizes.length && !p.sizes.includes(size)) throw new HttpError(400, `"${p.name}": хэмжээ буруу`);
      const qty = int(i.qty, "Тоо");
      if (qty < 1 || qty > 99) throw new HttpError(400, "Тоо ширхэг буруу");
      return { id: p.id, name: p.name, size, qty, price: p.price };
    });

    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    let couponCode = null, discount = 0;
    if (b.coupon) {
      const c = await prisma.coupon.findUnique({ where: { code: String(b.coupon).trim().toUpperCase() } });
      if (!c?.active) throw new HttpError(400, "Купон код хүчингүй болсон байна");
      couponCode = c.code;
      discount = Math.round(subtotal * c.percent / 100);
    }

    const order = await prisma.order.create({
      data: { name, phone, address, items, subtotal, discount, total: subtotal - discount, couponCode },
    });
    res.status(201).json({ id: order.id, total: order.total });
  },
  GET: admin(async (req, res) => {
    res.json(await prisma.order.findMany({ orderBy: { id: "desc" }, take: 500 }));
  }),
  PATCH: admin(async (req, res) => {
    const status = body(req).status === "shipped" ? "shipped" : "new";
    const o = await prisma.order.update({ where: { id: int(req.query.id, "id") }, data: { status } })
      .catch(e => { throw e.code === "P2025" ? new HttpError(404, "Захиалга олдсонгүй") : e; });
    res.json(o);
  }),
  DELETE: admin(async (req, res) => {
    await prisma.order.deleteMany({ where: { id: int(req.query.id, "id") } });
    res.json({ ok: true });
  }),
});
