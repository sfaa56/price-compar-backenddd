# استخدم Node الرسمي (يدعم Playwright)
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

# تعيين مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY package*.json ./

# تثبيت التبعيات
RUN npm install

# نسخ باقي الملفات
COPY . .

# تعيين المنفذ (Railway يستخدمه تلقائيًا)
EXPOSE 4000

# أمر التشغيل
CMD ["npm", "start"]
