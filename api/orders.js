import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { admin, body, int, route, str, HttpError } from "../lib/http.js";
import { left, sizesOf } from "../lib/stock.js";
import { sendAll } from "../lib/mail.js";
import { loadSettings } from "../lib/settings.js";
import { adminNewOrder, customerPaid, customerPlaced, customerShipped, siteUrl } from "../lib/emails.js";

const STATUSES = ["new", "paid", "shipped", "cancelled"];
const PHONE = /^[0-9+ ]{8,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adds `sign * qty` back onto each tracked size. Callers hold row locks inside a transaction.
async function adjustStock(tx, items, sign){
  const ids = [...new Set(items.map(i => i.id))];
  if (!ids.length) return;
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
  const products = await tx.product.findMany({ where: { id: { in: ids } }, select: { id:true, stock:true } });
  for (const p of products) {
    const stock = { ...(p.stock || {}) };
    let changed = false;
    for (const i of items.filter(i => i.id === p.id)) {
      if (Number.isInteger(stock[i.size])) { stock[i.size] = Math.max(0, stock[i.size] + sign * i.qty); changed = true; }
    }
    if (changed) await tx.product.update({ where: { id: p.id }, data: { stock } });
  }
}

function customer(b){
  const c = {
    name: str(b.name, "Нэр", { max: 100, required: true }),
    email: str(b.email, "И-мэйл", { max: 120, required: true }),
    phone: str(b.phone, "Утас", { max: 20, required: true }),
    phone2: str(b.phone2, "Яаралтай үед холбогдох утас", { max: 20, required: true }),
    city: str(b.city, "Хот/Аймаг", { max: 60, required: true }),
    district: str(b.district, "Дүүрэг/Сум", { max: 60, required: true }),
    khoroo: str(b.khoroo, "Хороо/Баг", { max: 60, required: true }),
    building: str(b.building, "Байр/Гудамж", { max: 120, required: true }),
    apartment: str(b.apartment, "Тоот", { max: 30, required: true }),
    address: str(b.note, "Нэмэлт мэдээлэл", { max: 1000 }),
  };
  if (!EMAIL.test(c.email)) throw new HttpError(400, "И-мэйл хаяг буруу байна");
  if (!PHONE.test(c.phone)) throw new HttpError(400, "Утасны дугаар буруу байна");
  if (!PHONE.test(c.phone2)) throw new HttpError(400, "Яаралтай үед холбогдох утас буруу байна");
  if (b.payment === "qpay") throw new HttpError(400, "QPay тун удахгүй нээгдэнэ. Дансаар шилжүүлэх сонголтыг ашиглана уу");
  return c;
}

export default route({
  // Public checkout. Prices, discount and stock are checked here, never trusted from the client.
  POST: async (req, res) => {
    const b = body(req);
    const c = customer(b);

    const wanted = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(i => ({
      id: int(i.id, "Бараа"), size: str(i.size, "Хэмжээ", { max: 20 }), qty: int(i.qty, "Тоо"),
    }));
    if (!wanted.length) throw new HttpError(400, "Авдар хоосон байна");
    if (wanted.some(i => i.qty < 1 || i.qty > 99)) throw new HttpError(400, "Тоо ширхэг буруу");

    let coupon = null;
    if (b.coupon) {
      coupon = await prisma.coupon.findUnique({ where: { code: String(b.coupon).trim().toUpperCase() } });
      if (!coupon?.active) throw new HttpError(400, "Купон код хүчингүй болсон байна");
    }

    const order = await prisma.$transaction(async tx => {
      const ids = [...new Set(wanted.map(i => i.id))];
      // Lock the rows so two simultaneous orders cannot both take the last item.
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const products = await tx.product.findMany({ where: { id: { in: ids } }, select: { id:true, name:true, price:true, compareAt:true, sizes:true, stock:true, sold:true } });

      const items = wanted.map(i => {
        const p = products.find(x => x.id === i.id);
        if (!p) throw new HttpError(400, "Авдарт байсан бараа устгагдсан байна");
        if (p.sold) throw new HttpError(400, `"${p.name}" дууссан байна`);
        if (!sizesOf(p).includes(i.size)) throw new HttpError(400, `"${p.name}": хэмжээ буруу`);
        const item = { id: p.id, name: p.name, size: i.size, qty: i.qty, price: p.price };
        if (p.compareAt > p.price) item.was = p.compareAt;   // shown struck through in emails
        return item;
      });
      for (const i of items) {
        const p = products.find(x => x.id === i.id);
        const need = items.filter(x => x.id === i.id && x.size === i.size).reduce((a, x) => a + x.qty, 0);
        const have = left(p, i.size);
        if (need > have) throw new HttpError(400, have > 0 ? `"${p.name}" (${i.size}) — ${have} ширхэг л үлдсэн байна` : `"${p.name}" (${i.size}) дууссан байна`);
      }
      await adjustStock(tx, items, -1);

      const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
      const discount = coupon ? Math.round(subtotal * coupon.percent / 100) : 0;
      return tx.order.create({ data: {
        ...c, payment: "bank", items, subtotal, discount, total: subtotal - discount, couponCode: coupon?.code ?? null,
      }});
    });

    // Confirmation to the customer + notification to the shop owner.
    const settings = await loadSettings().catch(() => ({}));
    const base = siteUrl(req);
    await sendAll([
      customerPlaced(base, order, settings),
      adminNewOrder(base, order, settings.notifyEmail || process.env.SMTP_USER),
    ]);
    res.status(201).json({ id: order.id, total: order.total });
  },

  GET: admin(async (req, res) => {
    res.json(await prisma.order.findMany({ orderBy: { id: "desc" }, take: 500 }));
  }),

  // Status and/or delivery fee change. Cancelling puts the items back into stock and is final.
  PATCH: admin(async (req, res) => {
    const id = int(req.query.id, "id");
    const b = body(req);
    const data = {};
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, "Төлөв буруу");
      data.status = b.status;
    }
    if (b.adminNote !== undefined) data.adminNote = str(b.adminNote, "Тэмдэглэл", { max: 2000 });
    if (b.deliveryFee !== undefined) {
      data.deliveryFee = (b.deliveryFee === "" || b.deliveryFee === null) ? null : int(b.deliveryFee, "Хүргэлтийн төлбөр");
      if (data.deliveryFee < 0) throw new HttpError(400, "Хүргэлтийн төлбөр буруу");
    }
    const o = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
      const cur = await tx.order.findUnique({ where: { id } });
      if (!cur) throw new HttpError(404, "Захиалга олдсонгүй");
      // A cancelled order keeps its status and fee; only the internal note can still change.
      if (cur.status === "cancelled" && (data.status !== undefined || data.deliveryFee !== undefined))
        throw new HttpError(400, "Цуцалсан захиалгыг өөрчлөх боломжгүй");
      if (data.status === "cancelled") await adjustStock(tx, cur.items, +1);
      const updated = await tx.order.update({ where: { id }, data });
      return { updated, changed: data.status && data.status !== cur.status };
    }).then(async ({ updated, changed }) => {
      // Tell the customer when payment is confirmed or the order is delivered.
      if (changed && updated.status === "paid") await sendAll([customerPaid(siteUrl(req), updated)]);
      if (changed && updated.status === "shipped") await sendAll([customerShipped(siteUrl(req), updated)]);
      return updated;
    });
    res.json(o);
  }),

  DELETE: admin(async (req, res) => {
    await prisma.order.deleteMany({ where: { id: int(req.query.id, "id") } });
    res.json({ ok: true });
  }),
});
