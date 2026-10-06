import { HttpError } from "./http.js";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE = 2 * 1024 * 1024;

// "data:image/...;base64,..." → { data: Buffer, type }
export function parseImage(dataUrl){
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !TYPES.includes(m[1])) throw new HttpError(400, "Зургийн формат буруу (PNG/JPG/WEBP)");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_IMAGE) throw new HttpError(400, "Зураг 2MB-аас их байна");
  return { data: buf, type: m[1] };
}

// Gallery sent by the admin, in display order. Each entry is { keep: <existing ref> } or { data: <data URL> }.
// isRef decides which keep values are valid for this gallery.
export function parseGallery(list, max, isRef){
  if (!Array.isArray(list)) throw new HttpError(400, "Зургийн жагсаалт буруу");
  if (list.length > max) throw new HttpError(400, `Хамгийн ихдээ ${max} зураг оруулна`);
  return list.map(e => {
    if (e && typeof e.data === "string") return parseImage(e.data);
    if (e && isRef(e.keep)) return { keep: e.keep };
    throw new HttpError(400, "Зургийн жагсаалт буруу");
  });
}
