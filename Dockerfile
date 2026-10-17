# AdFlash: website + API + render worker in one container.
# Works on Railway, Render.com, Fly.io or any VPS with Docker. Needs a long-running server
# (renders take minutes) - not serverless.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg espeak-ng ca-certificates fonts-noto-core fonts-noto-color-emoji fonts-dejavu-core fonts-inter \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
      libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
COPY package*.json ./
RUN npm ci && npx puppeteer browsers install chrome-headless-shell
COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/index.js"]
