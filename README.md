# CORSEL дэлгүүр

Энгийн HTML дэлгүүр + Vercel serverless API + Prisma Postgres.

```
public/        дэлгүүр (index.html), админ (admin.html), зураг
api/           серверийн API (бараа, захиалга, купон, нэвтрэлт)
lib/           Prisma клиент, нэвтрэлт, туслах функц
prisma/        өгөгдлийн сангийн схем
```

## Vercel дээр байршуулах

1. Кодоо GitHub repo руу хийнэ (эсвэл доорх CLI аргыг ашиглана).
2. vercel.com → **Add New → Project** → repo-гоо сонгоно. Framework: **Other**. Бусдыг нь өөрчлөхгүй.
3. Төслийн **Storage** таб → **Create Database** → **Prisma Postgres** → **Connect**.
   Энэ нь `DATABASE_URL` орчны хувьсагчийг автоматаар нэмнэ.
4. **Settings → Environment Variables** → `ADMIN_PASSWORD` нэмнэ (админы нууц үг, урт хүчтэй үг сонгоно).
5. **Deployments → Redeploy**. Build хийх үед өгөгдлийн сангийн хүснэгтүүд автоматаар үүснэ (`prisma db push`).
6. `https://<таны-сайт>.vercel.app/admin` руу ороод нууц үгээрээ нэвтэрч бараагаа нэмнэ.

CLI-аар: `npx vercel` → дээрх 3–4-р алхмыг Vercel dashboard дээр хийгээд → `npx vercel --prod`.

## И-мэйл мэдэгдэл (Gmail)

Захиалга орох үед танд, захиалга өгөх / төлбөр орох / хүргэгдэх үед үйлчлүүлэгчид и-мэйл очно.

1. Gmail акаунт дээрээ **2-Step Verification** асаасан байх ёстой (myaccount.google.com → Security).
2. https://myaccount.google.com/apppasswords → нэр өгөөд (жишээ нь `corsel`) **Create** → гарсан 16 тэмдэгтийг хуулна.
3. Vercel → **Settings → Environment Variables**:
   - `SMTP_USER` = таны Gmail хаяг
   - `SMTP_PASS` = 16 тэмдэгт App Password (зайг хасаж бичнэ)
4. **Redeploy**. Админ → **Тохиргоо** хэсэгт "✓ И-мэйл идэвхтэй" гэж гарна. Мэдэгдэл өөр хаяг руу ирүүлэх бол тэнд бичнэ.

Gmail өдөрт ~500 и-мэйл илгээх хязгаартай. SMTP тохируулаагүй үед дэлгүүр хэвийн ажиллана, зүгээр л и-мэйл илгээхгүй.

## Компьютер дээрээ ажиллуулах

```bash
npm install
npx prisma dev --name corsel --detach   # локал Prisma Postgres асаана
```
Гарсан `postgres://...` хаягийг `.env` файлын `DATABASE_URL`-д, мөн `ADMIN_PASSWORD`-оо бичнэ (`.env.example`-ийг хуулж болно). Дараа нь:
```bash
npx prisma db push
npm run dev          # http://localhost:3000, админ: /admin
```
