# Worker do Estúdio: Chromium (Playwright) para os slides, Remotion e ffmpeg para os reels.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npx remotion browser ensure

COPY . .
ENV NODE_ENV=production
CMD ["node", "src/worker.mjs"]
