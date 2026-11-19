# Worker do Estúdio: Chromium (Playwright) para os slides, Remotion e ffmpeg para os reels.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

# A imagem vem apontada para o espelho da Azure, que costuma não responder fora dela
# (no build da Railway dá timeout). Troca pelo espelho oficial e tenta de novo se a rede oscilar.
RUN find /etc/apt -name '*.list' -o -name '*.sources' | xargs -r sed -i 's|azure.archive.ubuntu.com|archive.ubuntu.com|g' \
  && apt-get -o Acquire::Retries=5 update \
  && apt-get -o Acquire::Retries=5 install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npx remotion browser ensure

COPY . .
ENV NODE_ENV=production
# Dorme até a API chamar POST /wake (ligue o Serverless do serviço na Railway).
CMD ["node", "src/worker.mjs", "--serve"]
