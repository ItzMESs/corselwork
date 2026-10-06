import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Sends through SMTP (Gmail by default). Without SMTP_USER/SMTP_PASS mail is skipped, so the
// shop keeps working before email is set up. MAIL_PREVIEW_DIR (local dev only) writes the
// HTML to files instead of sending.
let transport;
function getTransport(){
  if (transport !== undefined) return transport;
  const { SMTP_USER: user, SMTP_PASS: pass, SMTP_HOST, SMTP_PORT } = process.env;
  if (process.env.MAIL_PREVIEW_DIR) transport = nodemailer.createTransport({ jsonTransport: true });
  else if (user && pass) {
    const port = +(SMTP_PORT || 465);
    transport = nodemailer.createTransport({ host: SMTP_HOST || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass } });
  } else transport = null;
  return transport;
}

export const mailReady = () => !!getTransport();
export const fromAddress = () => process.env.SMTP_USER || "";

export async function sendMail({ to, subject, html, replyTo }){
  const t = getTransport();
  if (!t || !to) return false;
  const from = `"${process.env.MAIL_FROM_NAME || "CORSEL"}" <${process.env.SMTP_USER || "preview@localhost"}>`;
  if (process.env.MAIL_PREVIEW_DIR) {
    await mkdir(process.env.MAIL_PREVIEW_DIR, { recursive: true });
    const file = join(process.env.MAIL_PREVIEW_DIR, `${Date.now()}-${String(to).replace(/[^\w.@-]/g, "_")}.html`);
    await writeFile(file, `<!-- to: ${to} | subject: ${subject} -->\n` + html);
    return true;
  }
  await t.sendMail({ from, to, subject, html, replyTo });
  return true;
}

// Never let a mail failure break the order itself.
export async function sendAll(messages){
  const results = await Promise.allSettled(messages.map(sendMail));
  results.forEach(r => { if (r.status === "rejected") console.error("mail failed:", r.reason?.message || r.reason); });
}
