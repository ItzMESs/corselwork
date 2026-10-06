/* Shared helpers for the shop (index.html) and admin (admin.html). Data lives in Prisma Postgres via /api. */

const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const fmt = n => (+n || 0).toLocaleString("en-US") + "₮";

async function api(path, { method = "GET", body } = {}){
  const r = await fetch("/api/" + path, {
    method, credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "Алдаа гарлаа"), { status: r.status });
  return data;
}

const PLACEHOLDER = `<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" fill="none" stroke="#ccc" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M50 40l8 8-8 8-8-8z" fill="none" stroke="#ccc" stroke-width="1.5"/></svg>`;
const art = p => p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : PLACEHOLDER;
