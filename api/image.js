import { prisma } from "../lib/db.js";
import { int, route, HttpError } from "../lib/http.js";

export default route({
  GET: async (req, res) => {
    const p = await prisma.product.findUnique({
      where: { id: int(req.query.id, "id") }, select: { image: true, imageType: true },
    });
    if (!p?.image) throw new HttpError(404, "Зураг олдсонгүй");
    res.setHeader("Content-Type", p.imageType);
    // The URL carries ?v=<updatedAt>, so the bytes behind a given URL never change.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(Buffer.from(p.image));
  },
});
