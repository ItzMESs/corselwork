import { prisma } from "../lib/db.js";
import { body, int, route, str, HttpError } from "../lib/http.js";

const digits = s => String(s || "").replace(/\D/g, "");

// Public order lookup: order number + the phone used at checkout.
// Returns no address/email, only what the customer needs to follow the order.
export default route({
  POST: async (req, res) => {
    const b = body(req);
    const id = int(b.id, "Захиалгын дугаар");
    const phone = digits(str(b.phone, "Утас", { max: 30, required: true }));
    const o = await prisma.order.findUnique({ where: { id } });
    if (!o || digits(o.phone) !== phone) throw new HttpError(404, "Захиалга олдсонгүй. Дугаар болон утсаа шалгана уу");
    res.setHeader("Cache-Control", "no-store");
    res.json({
      id: o.id, createdAt: o.createdAt, status: o.status, payment: o.payment, items: o.items,
      subtotal: o.subtotal, discount: o.discount, couponCode: o.couponCode, total: o.total,
      deliveryFee: o.deliveryFee, city: o.city, district: o.district,
    });
  },
});
