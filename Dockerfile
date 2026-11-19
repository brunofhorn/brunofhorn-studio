# Worker do Estúdio: Chromium (Playwright) para os slides e Remotion (com o próprio ffmpeg) para os reels.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

# Sem apt: os espelhos do Ubuntu (porta 80) não respondem no build da Railway. O Remotion traz o
# próprio ffmpeg para o MP4; o do sistema só nivelaria a trilha, que já sai sintetizada no volume.
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# O Remotion usa o Chrome headless que a imagem do Playwright já traz (src/reel.mjs): sem
# baixar o dele, que falhava no render ("No browser found for rendering frames").
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY . .
ENV NODE_ENV=production
# Dorme até a API chamar POST /wake (ligue o Serverless do serviço na Railway).
CMD ["node", "src/worker.mjs", "--serve"]
