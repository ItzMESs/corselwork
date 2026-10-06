import { prisma } from "../lib/db.js";
import { isAdmin } from "../lib/auth.js";
import { admin, body, route, str, HttpError } from "../lib/http.js";
import { fromAddress, mailReady } from "../lib/mail.js";
import { parseGallery } from "../lib/images.js";
import { LONG_KEYS, loadSettings, PUBLIC_KEYS, SETTING_KEYS, URL_KEYS } from "../lib/settings.js";

const MAX_ABOUT_IMAGES = 8;

async function aboutImages(){
  const rows = await prisma.siteImage.findMany({ where: { slot: "about" }, select: { id: true }, orderBy: { position: "asc" } });
  // Rows are recreated on every save, so the id alone is a stable cache key.
  return rows.map(r => ({ ref: r.id, url: `/api/image?site=${r.id}` }));
}

async function full(req){
  const s = await loadSettings();
  const base = isAdmin(req) ? { ...s, mailReady: mailReady(), mailFrom: fromAddress() } : Object.fromEntries(PUBLIC_KEYS.map(k => [k, s[k]]));
  return { ...base, aboutImages: await aboutImages() };
}

export default route({
  // Public: bank details, About page content and links. Admin also gets the notification email and mail status.
  GET: async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await full(req));
  },
  PUT: admin(async (req, res) => {
    const b = body(req);
    const values = SETTING_KEYS.filter(k => b[k] !== undefined).map(k => {
      const value = str(b[k], k, { max: LONG_KEYS.includes(k) ? 5000 : 500 });
      if (URL_KEYS.includes(k) && value && !/^https:\/\/\S+$/.test(value)) throw new HttpError(400, `${k}: https://-ээр эхэлсэн холбоос оруулна уу`);
      return [k, value];
    });
    const gallery = b.aboutImages === undefined ? undefined : parseGallery(b.aboutImages, MAX_ABOUT_IMAGES, Number.isInteger);

    await prisma.$transaction(async tx => {
      for (const [key, value] of values) await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      if (gallery !== undefined) {
        const current = await tx.siteImage.findMany({ where: { slot: "about" } });
        const resolved = gallery.map(g => {
          if (!g.keep) return g;
          const x = current.find(c => c.id === g.keep);
          if (!x) throw new HttpError(400, "Зураг олдсонгүй, хуудсаа дахин ачаална уу");
          return { data: Buffer.from(x.data), type: x.type };
        });
        await tx.siteImage.deleteMany({ where: { slot: "about" } });
        if (resolved.length) await tx.siteImage.createMany({ data: resolved.map((r, i) => ({ slot: "about", position: i, data: r.data, type: r.type })) });
      }
    }, { timeout: 20000 });
    res.json(await full(req));
  }),
});
