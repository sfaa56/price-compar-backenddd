# استخدم صورة Playwright الجاهزة (فيها المتصفحات)
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

# تعيين مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع الأساسية
COPY package*.json ./

# تثبيت التبعيات
RUN npm install

# نسخ باقي الملفات
COPY . .

# ✅ تثبيت Xvfb لمحاكاة واجهة رسومية داخل Docker
RUN apt-get update && apt-get install -y xvfb

# ✅ تعيين متغير البيئة لمحاكاة الشاشة
ENV DISPLAY=:99

# ✅ تعيين المنفذ (Railway يستخدمه تلقائيًا)
EXPOSE 4000

# ✅ تشغيل السيرفر عبر Xvfb لتفعيل الـ headful browser
CMD ["xvfb-run", "-a", "npm", "start"]
