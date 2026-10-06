import { prisma } from "../lib/db.js";
import { admin, body, int, route, str, HttpError } from "../lib/http.js";
import { sizesOf, soldOut } from "../lib/stock.js";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE = 2 * 1024 * 1024;
const select = { id:true, name:true, nameEn:true, price:true, sizes:true, stock:true, description:true, sold:true, imageType:true, updatedAt:true };

// Image bytes are served separately by /api/image; the list only carries its URL.
// `sold` is the manual flag, `soldOut` also covers stock running out.
const toPublic = ({ imageType, updatedAt, ...p }) => ({
  ...p, stock: p.stock || {}, soldOut: soldOut(p),
  image: imageType ? `/api/image?id=${p.id}&v=${updatedAt.getTime()}` : null,
});

function parseImage(dataUrl){
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !TYPES.includes(m[1])) throw new HttpError(400, "Зургийн формат буруу (PNG/JPG/WEBP)");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_IMAGE) throw new HttpError(400, "Зураг 2MB-аас их байна");
  return { image: buf, imageType: m[1] };
}

function fields(b){
  const data = {
    name: str(b.name, "Нэр", { max: 120, required: true }),
    nameEn: str(b.nameEn, "Нэр (EN)", { max: 120 }),
    price: int(b.price, "Үнэ"),
    sizes: [...new Set((Array.isArray(b.sizes) ? b.sizes : []).map(s => str(s, "Хэмжээ", { max: 20 })).filter(Boolean))].slice(0, 20),
    description: str(b.description, "Тайлбар", { max: 3000 }),
    sold: !!b.sold,
  };
  if (data.price < 0) throw new HttpError(400, "Үнэ буруу байна");
  // Keep only counts for this product's sizes; blank/absent = unlimited.
  const stock = {};
  const raw = b.stock && typeof b.stock === "object" ? b.stock : {};
  for (const s of sizesOf(data)) {
    if (raw[s] === "" || raw[s] == null) continue;
    const n = int(raw[s], `Үлдэгдэл (${s})`);
    if (n < 0) throw new HttpError(400, "Үлдэгдэл сөрөг байж болохгүй");
    stock[s] = n;
  }
  data.stock = stock;
  // image: data URL = replace, null = remove, omitted = keep
  if (b.image === null) Object.assign(data, { image: null, imageType: null });
  else if (typeof b.image === "string") Object.assign(data, parseImage(b.image));
  return data;
}

export default route({
  GET: async (req, res) => {
    const list = await prisma.product.findMany({ select, orderBy: { id: "desc" } });
    res.setHeader("Cache-Control", "no-store");
    res.json(list.map(toPublic));
  },
  POST: admin(async (req, res) => {
    const p = await prisma.product.create({ data: fields(body(req)), select });
    res.status(201).json(toPublic(p));
  }),
  PUT: admin(async (req, res) => {
    const id = int(req.query.id, "id");
    const p = await prisma.product.update({ where: { id }, data: fields(body(req)), select })
      .catch(e => { throw e.code === "P2025" ? new HttpError(404, "Бараа олдсонгүй") : e; });
    res.json(toPublic(p));
  }),
  DELETE: admin(async (req, res) => {
    await prisma.product.deleteMany({ where: { id: int(req.query.id, "id") } });
    res.json({ ok: true });
  }),
});
