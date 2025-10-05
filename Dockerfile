FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libnss3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libgbm1 \
    libgtk-3-0 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright dependencies
RUN npx playwright install --with-deps chromium

WORKDIR /app
COPY . .

EXPOSE 4000
CMD ["node", "server.js"]
