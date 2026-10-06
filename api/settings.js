import { prisma } from "../lib/db.js";
import { isAdmin } from "../lib/auth.js";
import { admin, body, route, str } from "../lib/http.js";
import { fromAddress, mailReady } from "../lib/mail.js";
import { loadSettings, PUBLIC_KEYS, SETTING_KEYS } from "../lib/settings.js";

export default route({
  // Public: bank details for checkout. Admin also gets the notification email and mail status.
  GET: async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const s = await loadSettings();
    if (!isAdmin(req)) return res.json(Object.fromEntries(PUBLIC_KEYS.map(k => [k, s[k]])));
    res.json({ ...s, mailReady: mailReady(), mailFrom: fromAddress() });
  },
  PUT: admin(async (req, res) => {
    const b = body(req);
    await prisma.$transaction(SETTING_KEYS.map(k => {
      const value = str(b[k], k, { max: 500 });
      return prisma.setting.upsert({ where: { key: k }, create: { key: k, value }, update: { value } });
    }));
    res.json({ ...(await loadSettings()), mailReady: mailReady(), mailFrom: fromAddress() });
  }),
});
