import { prisma } from "./db.js";

// Shop settings edited in the admin "Тохиргоо" tab.
export const PUBLIC_KEYS = [
  "bankName", "bankAccount", "bankHolder", "bankNote",
  "aboutText", "aboutTextEn", "instagram", "facebook", "tiktok", "contactPhone", "contactEmail",
];
export const SETTING_KEYS = [...PUBLIC_KEYS, "notifyEmail"];
export const LONG_KEYS = ["aboutText", "aboutTextEn"];   // allowed up to 5000 chars
export const URL_KEYS = ["instagram", "facebook", "tiktok"];

export async function loadSettings(){
  const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
  return Object.fromEntries(SETTING_KEYS.map(k => [k, rows.find(r => r.key === k)?.value || ""]));
}
