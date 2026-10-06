// HTML email templates (table layout + inline styles so Gmail/Outlook render them).
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const fmt = n => (+n || 0).toLocaleString("en-US") + "₮";
const RED = "#c51811";

export function siteUrl(req){
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || (/^localhost|^127\./.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

const fullAddress = o => [o.city, o.district, o.khoroo && `${o.khoroo} хороо/баг`, o.building, o.apartment && `${o.apartment} тоот`].filter(Boolean).join(", ");
const dateStr = d => new Date(d).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function layout(base, title, intro, body){
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e6e6">
  <tr><td align="center" style="padding:24px 24px 8px"><img src="${base}/logo.png" width="64" height="64" alt="CORSEL" style="display:block;border:0"></td></tr>
  <tr><td style="padding:8px 28px 0"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${title}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#333">${intro}</p></td></tr>
  ${body}
  <tr><td style="padding:20px 28px 28px;font-size:11px;line-height:1.6;color:#888;border-top:1px solid #eee">
    Энэ и-мэйл автоматаар илгээгдсэн. Асуух зүйл байвал энэ и-мэйлд хариу бичнэ үү.<br>
    <a href="${base}" style="color:#888">${esc(base.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const section = (title, rows) => `<tr><td style="padding:0 28px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6">
    <tr><td colspan="2" style="padding:12px 16px;font-weight:bold;font-size:14px;border-bottom:1px solid #e6e6e6">${title}</td></tr>
    ${rows}
  </table></td></tr>`;
const row = (label, value, color) => value === "" || value == null ? "" : `<tr>
  <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;width:40%;vertical-align:top">${label}</td>
  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;${color ? `color:${color};` : ""}">${value}</td></tr>`;

function itemsSection(base, o){
  const rows = o.items.map(i => `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;width:72px"><img src="${base}/api/image?id=${i.id}" width="64" height="64" alt="" style="display:block;object-fit:contain;border:1px solid #eee;background:#fff"></td>
    <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px"><b>${esc(i.name)}</b><br><span style="color:#777">${esc(i.size)} × ${i.qty}</span></td>
    <td align="right" style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;white-space:nowrap">
      ${i.was ? `<span style="color:${RED};font-weight:bold">${fmt(i.price * i.qty)}</span><br><s style="color:#999">${fmt(i.was * i.qty)}</s>` : fmt(i.price * i.qty)}</td></tr>`).join("");
  return `<tr><td style="padding:0 28px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6">
      <tr><td colspan="3" style="padding:12px 16px;font-weight:bold;font-size:14px;border-bottom:1px solid #e6e6e6">Захиалсан бараа (${o.items.reduce((a, i) => a + i.qty, 0)})</td></tr>
      ${rows}</table></td></tr>`;
}

function totalsSection(o){
  const fee = o.deliveryFee;
  return section("Төлбөрийн задаргаа",
    row("Барааны дүн", fmt(o.subtotal)) +
    (o.discount ? row(`Купон ${esc(o.couponCode || "")}`, "−" + fmt(o.discount), "#1a8a3a") : "") +
    row("Хүргэлт", fee == null ? "Нэмэлтээр тооцно" : fmt(fee), fee == null ? "#d97706" : "") +
    `<tr><td style="padding:14px 16px;font-size:15px;font-weight:bold">Нийт төлөх</td>
      <td style="padding:14px 16px;font-size:18px;font-weight:bold">${fmt(o.total + (fee || 0))}${fee == null ? `<span style="font-size:11px;color:#777;font-weight:normal"> + хүргэлт</span>` : ""}</td></tr>`);
}

function infoSection(o, { full }){
  return section("Захиалгын мэдээлэл",
    row("Захиалгын дугаар", `<b>#${o.id}</b>`) +
    row("Хүлээн авагч", esc(o.name)) +
    row("Утас", esc(o.phone) + (o.phone2 ? ` · <span style="color:#777">${esc(o.phone2)}</span>` : "")) +
    (full ? row("И-мэйл", esc(o.email)) : "") +
    row("Хүргэх хаяг", esc(fullAddress(o)) + (o.address ? `<br><span style="color:#777">${esc(o.address)}</span>` : "")) +
    row("Төлбөрийн хэлбэр", o.payment === "qpay" ? "QPay" : "Дансаар шилжүүлэх") +
    row("Огноо", dateStr(o.createdAt)));
}

const button = (href, text) => `<tr><td style="padding:4px 28px 24px">
  <a href="${href}" style="display:block;background:#111;color:#fff;text-align:center;padding:14px;font-weight:bold;font-size:14px;text-decoration:none">${text}</a>
  <p style="margin:10px 0 0;font-size:11px;color:#888;word-break:break-all">Холбоос ажиллахгүй бол: <a href="${href}" style="color:#888">${href}</a></p></td></tr>`;

const trackUrl = (base, o) => `${base}/#/track/${o.id}/${encodeURIComponent(String(o.phone).replace(/\D/g, ""))}`;

function bankSection(o, s){
  if (!s.bankAccount) return "";
  return section("Төлбөр шилжүүлэх данс",
    row("Банк", esc(s.bankName)) + row("Дансны дугаар", `<b>${esc(s.bankAccount)}</b>`) + row("Хүлээн авагч", esc(s.bankHolder)) +
    row("Дүн", `<b>${fmt(o.total)}</b>`) + row("Гүйлгээний утга", `<b>${o.id} ${esc(o.phone)}</b>`, RED) +
    (s.bankNote ? row("Тэмдэглэл", esc(s.bankNote).replace(/\n/g, "<br>")) : ""));
}

/* ---------- Messages ---------- */
export function customerPlaced(base, o, settings){
  return { to: o.email, subject: `Захиалга #${o.id} хүлээн авлаа - CORSEL`, html: layout(base,
    "Захиалга хүлээн авлаа 🧾",
    `Сайн байна уу, ${esc(o.name)}. Таны <b>#${o.id}</b> дугаартай захиалгыг хүлээн авлаа. Доорх дансанд төлбөрөө шилжүүлсний дараа захиалга баталгаажна.`,
    bankSection(o, settings) + infoSection(o, { full: false }) + itemsSection(base, o) + totalsSection(o) + button(trackUrl(base, o), "Захиалга харах")) };
}

export function customerPaid(base, o){
  return { to: o.email, subject: `Захиалга амжилттай төлөгдлөө ✅ - CORSEL`, html: layout(base,
    "Захиалга амжилттай төлөгдлөө ✅",
    `Сайн байна уу, ${esc(o.name)}. Таны <b>#${o.id}</b> дугаартай захиалгын төлбөр баталгаажлаа. Бид захиалгыг тань бэлтгэж эхэлж байна. Хүргэлтийн талаар тантай холбогдоно.`,
    infoSection(o, { full: false }) + itemsSection(base, o) + totalsSection(o) + button(trackUrl(base, o), "Захиалга харах")) };
}

export function customerShipped(base, o){
  return { to: o.email, subject: `Захиалга #${o.id} хүргэгдлээ 📦 - CORSEL`, html: layout(base,
    "Захиалга хүргэгдлээ 📦",
    `Сайн байна уу, ${esc(o.name)}. Таны <b>#${o.id}</b> дугаартай захиалга хүргэгдлээ. CORSEL-ийг сонгосонд баярлалаа!`,
    infoSection(o, { full: false }) + itemsSection(base, o) + totalsSection(o) + button(trackUrl(base, o), "Захиалга харах")) };
}

export function adminNewOrder(base, o, to){
  return { to, replyTo: o.email || undefined, subject: `🛒 Шинэ захиалга #${o.id} — ${fmt(o.total)} (${o.name})`, html: layout(base,
    `Шинэ захиалга #${o.id}`,
    `${esc(o.name)} захиалга өглөө. Нийт <b>${fmt(o.total)}</b>${o.deliveryFee == null ? " + хүргэлт" : ""}. Төлбөр орсон эсэхийг шалгаад админ дээр төлвийг нь солино уу.`,
    infoSection(o, { full: true }) + itemsSection(base, o) + totalsSection(o) + button(`${base}/admin`, "Админ руу орох")) };
}
