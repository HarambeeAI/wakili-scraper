FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
# Install Playwright Chromium for Marketer browser automation
# PLAYWRIGHT_BROWSERS_PATH points to the Railway persistent volume so Chromium
# survives container restarts without re-downloading (~300 MB)
ENV PLAYWRIGHT_BROWSERS_PATH=/playwright-data
RUN npx -y playwright@1.58.2 install chromium --with-deps

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["node", "dist/index.js"]
