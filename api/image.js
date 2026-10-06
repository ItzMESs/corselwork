import { prisma } from "../lib/db.js";
import { int, route, HttpError } from "../lib/http.js";

// ?id=<product> serves the cover image, ?img=<ProductImage id> a gallery image.
export default route({
  GET: async (req, res) => {
    let data, type;
    if (req.query.img !== undefined) {
      const x = await prisma.productImage.findUnique({ where: { id: int(req.query.img, "img") }, select: { data: true, type: true } });
      data = x?.data; type = x?.type;
    } else {
      const p = await prisma.product.findUnique({ where: { id: int(req.query.id, "id") }, select: { image: true, imageType: true } });
      data = p?.image; type = p?.imageType;
    }
    if (!data) throw new HttpError(404, "Зураг олдсонгүй");
    res.setHeader("Content-Type", type);
    // URLs carry ?v=<updatedAt>, so the bytes behind a given URL never change.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(Buffer.from(data));
  },
});
