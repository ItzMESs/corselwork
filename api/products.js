import { prisma } from "../lib/db.js";
import { admin, body, int, route, str, HttpError } from "../lib/http.js";
import { sizesOf, soldOut } from "../lib/stock.js";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_IMAGES = 8;
const select = {
  id:true, name:true, nameEn:true, price:true, compareAt:true, sizes:true, stock:true, description:true, sold:true, imageType:true, updatedAt:true,
  images: { select: { id:true }, orderBy: { position: "asc" } },
};

// Image bytes are served separately by /api/image; the list only carries URLs.
// `images` is the whole gallery (cover first), `image` is the cover for grids and emails.
// `sold` is the manual flag, `soldOut` also covers stock running out.
function toPublic({ imageType, updatedAt, images, ...p }){
  const v = updatedAt.getTime();
  const gallery = [
    ...(imageType ? [{ ref: "cover", url: `/api/image?id=${p.id}&v=${v}` }] : []),
    ...images.map(i => ({ ref: i.id, url: `/api/image?img=${i.id}&v=${v}` })),
  ];
  return { ...p, stock: p.stock || {}, soldOut: soldOut(p), image: gallery[0]?.url || null, images: gallery };
}

function parseImage(dataUrl){
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !TYPES.includes(m[1])) throw new HttpError(400, "Зургийн формат буруу (PNG/JPG/WEBP)");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_IMAGE) throw new HttpError(400, "Зураг 2MB-аас их байна");
  return { data: buf, type: m[1] };
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
  // Old price only makes sense above the current price; blank clears the sale.
  data.compareAt = (b.compareAt === "" || b.compareAt == null) ? null : int(b.compareAt, "Хуучин үнэ");
  if (data.compareAt !== null && data.compareAt <= data.price) throw new HttpError(400, "Хуучин үнэ одоогийн үнээс их байх ёстой");
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
  return data;
}

// Gallery sent by the admin, in display order. Each entry is
//   { keep: "cover" | <ProductImage id> }  an image already stored for this product, or
//   { data: "data:image/...;base64,..." }  a new upload.
// Omitted (undefined) = leave the gallery as it is.
function parseGallery(list){
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) throw new HttpError(400, "Зургийн жагсаалт буруу");
  if (list.length > MAX_IMAGES) throw new HttpError(400, `Хамгийн ихдээ ${MAX_IMAGES} зураг оруулна`);
  return list.map(e => {
    if (e && typeof e.data === "string") return parseImage(e.data);
    if (e && (e.keep === "cover" || Number.isInteger(e.keep))) return { keep: e.keep };
    throw new HttpError(400, "Зургийн жагсаалт буруу");
  });
}

// Resolves kept images to their bytes, then rewrites cover + extras in the new order.
async function saveGallery(tx, productId, gallery){
  const current = await tx.product.findUnique({ where: { id: productId }, select: { image: true, imageType: true } });
  const extras = await tx.productImage.findMany({ where: { productId } });
  const resolved = gallery.map(g => {
    if (!g.keep) return g;
    if (g.keep === "cover") {
      if (!current?.image) throw new HttpError(400, "Зураг олдсонгүй, хуудсаа дахин ачаална уу");
      return { data: Buffer.from(current.image), type: current.imageType };
    }
    const x = extras.find(i => i.id === g.keep);
    if (!x) throw new HttpError(400, "Зураг олдсонгүй, хуудсаа дахин ачаална уу");
    return { data: Buffer.from(x.data), type: x.type };
  });
  const [cover, ...rest] = resolved;
  await tx.productImage.deleteMany({ where: { productId } });
  if (rest.length) await tx.productImage.createMany({ data: rest.map((r, i) => ({ productId, position: i, data: r.data, type: r.type })) });
  await tx.product.update({ where: { id: productId }, data: { image: cover?.data ?? null, imageType: cover?.type ?? null } });
}

// Accepts the old single `image` field too (data URL = replace cover, null = remove all).
function legacyGallery(b){
  if (b.images !== undefined) return parseGallery(b.images);
  if (b.image === null) return [];
  if (typeof b.image === "string" && b.image.startsWith("data:")) return [parseImage(b.image)];   // ignore echoed URLs
  return undefined;
}

export default route({
  GET: async (req, res) => {
    const list = await prisma.product.findMany({ select, orderBy: { id: "desc" } });
    res.setHeader("Cache-Control", "no-store");
    res.json(list.map(toPublic));
  },
  POST: admin(async (req, res) => {
    const b = body(req), data = fields(b), gallery = legacyGallery(b);
    if (gallery?.some(g => g.keep)) throw new HttpError(400, "Зургийн жагсаалт буруу");
    const p = await prisma.$transaction(async tx => {
      const created = await tx.product.create({ data, select: { id: true } });
      if (gallery?.length) await saveGallery(tx, created.id, gallery);
      return tx.product.findUnique({ where: { id: created.id }, select });
    }, { timeout: 20000 });
    res.status(201).json(toPublic(p));
  }),
  PUT: admin(async (req, res) => {
    const id = int(req.query.id, "id");
    const b = body(req), data = fields(b), gallery = legacyGallery(b);
    const p = await prisma.$transaction(async tx => {
      const found = await tx.product.findUnique({ where: { id }, select: { id: true } });
      if (!found) throw new HttpError(404, "Бараа олдсонгүй");
      await tx.product.update({ where: { id }, data });
      if (gallery !== undefined) await saveGallery(tx, id, gallery);
      return tx.product.findUnique({ where: { id }, select });
    }, { timeout: 20000 });
    res.json(toPublic(p));
  }),
  DELETE: admin(async (req, res) => {
    await prisma.product.deleteMany({ where: { id: int(req.query.id, "id") } });
    res.json({ ok: true });
  }),
});
