FROM node:22-alpine AS base

# Install Playwright Chromium (needed for CV PDF generation & form auto-fill)
RUN apk add --no-cache chromium dumb-init tini nss freetype freetype-dev libjpeg-turbo libpng giflib libcups librsvg harfbuzz pango curl ca-certificates fonts-noto \
    && npx playwright install --with-deps chromium 2>/dev/null || true

WORKDIR /app

# ── Dependencies ──
COPY package-lock.json package.json ./
RUN npm ci --omit=dev 2>&1 | tail -1

# ── Build ──
COPY . .
RUN npm run build 2>&1 | tail -5

# ── Production ──
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache chromium dumb-init tini nss freetype freetype-dev libjpeg-turbo libpng giflib libcups librsvg harfbuzz pango curl ca-certificates fonts-noto

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/package.json ./package.json

ENV PORT=3000
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/bin/chromium-browser

EXPOSE 3000

# Start Next.js production server
CMD ["node", "node_modules/.bin/next", "start"]
