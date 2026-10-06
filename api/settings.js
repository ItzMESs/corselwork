import { prisma } from "../lib/db.js";
import { admin, body, route, str } from "../lib/http.js";

// Public shop settings (bank transfer details shown at checkout).
const KEYS = ["bankName", "bankAccount", "bankHolder", "bankNote"];

async function load(){
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  return Object.fromEntries(KEYS.map(k => [k, rows.find(r => r.key === k)?.value || ""]));
}

export default route({
  GET: async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await load());
  },
  PUT: admin(async (req, res) => {
    const b = body(req);
    await prisma.$transaction(KEYS.map(k => {
      const value = str(b[k], k, { max: 500 });
      return prisma.setting.upsert({ where: { key: k }, create: { key: k, value }, update: { value } });
    }));
    res.json(await load());
  }),
});
