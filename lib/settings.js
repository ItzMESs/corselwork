import { prisma } from "./db.js";

// Shop settings edited in the admin "Тохиргоо" tab.
export const SETTING_KEYS = ["bankName", "bankAccount", "bankHolder", "bankNote", "notifyEmail"];
export const PUBLIC_KEYS = ["bankName", "bankAccount", "bankHolder", "bankNote"];

export async function loadSettings(){
  const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
  return Object.fromEntries(SETTING_KEYS.map(k => [k, rows.find(r => r.key === k)?.value || ""]));
}
