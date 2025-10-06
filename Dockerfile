FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

# نسخ وتثبيت الحزم
COPY package*.json ./
RUN npm install

COPY . .

# استمع على البورت اللي Railway يعطيه
ENV PORT=4000
EXPOSE 4000

# شغّل السيرفر مباشرة (بدون xvfb)
CMD ["npm", "start"]
